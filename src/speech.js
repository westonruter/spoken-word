
import React, { render, unmountComponentAtNode } from 'preact-compat';
import EventEmitter from 'event-emitter';
import chunkify, { getWeightedChunkLanguages } from './chunkify';
import * as voices from './voices';
import { equalRanges, scrollElementIntoViewIfNeeded } from './helpers';
import PlaybackControls from './components/PlaybackControls';
import isEqual from 'lodash/isEqual';

/**
 * ASCII code for ESC.
 *
 * @type {number}
 */
const ESCAPE_KEY_CODE = 27;

/**
 * A segment of text nodes that are to be read by the TTS engine.
 *
 * @typedef {object} Chunk
 * @property {Array}   nodes    - Text nodes.
 * @property {string}  language - Language for text nodes.
 * @property {Element} root     - Container element, not necessarily the parent.
 */

/**
 * CSS selector for headings.
 *
 * @type {string}
 */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/**
 * CSS selector for which elements should get paragraph pauses.
 *
 * @type {string}
 */
const PARAGRAPH_PAUSE_SELECTOR = 'blockquote, p, dt';

/**
 * Pauses (in milliseconds) where the TTS engine should pause between speaking chunks.
 *
 * @type {object}
 */
const DEFAULT_PAUSE_DURATIONS = {
	heading: 1000,
	paragraph: 500,
};

/**
 * Number of characters within which an offset is considered to be at the beginning of a chunk.
 *
 * If previous() is called when the offset is less than this number, then the previous chunk will be navigated to.
 * Otherwise, the offset will be set to zero to move the cursor to the beginning of the current chunk.
 *
 * @type {number}
 */
const CHUNK_BEGINNING_OFFSET_THRESHOLD = 10;

/**
 * Representing a spoken section.
 *
 * @todo Switch to higher-order React.Component.
 * @augments EventEmitter
 */
export default class Speech {
	/**
	 * Construct.
	 *
	 * @param {Object}  args                    - Args.
	 * @param {Element} args.rootElement        - Element.
	 * @param {Object}  args.utteranceOptions   - Default utterance options.
	 * @param {Object}  args.chunkifyOptions    - Chunkify options.
	 * @param {Object}  args.pauseDurations     - Pause durations.
	 * @param {boolean} args.useDashicons=false - Whether to use Dashicons (as opposed to Emoji).
	 */
	constructor( {
		rootElement,
		useDashicons = false,
		utteranceOptions = {},
		chunkifyOptions,
		pauseDurations = DEFAULT_PAUSE_DURATIONS,
	} ) {
		this.rootElement = rootElement;
		this.chunkifyOptions = chunkifyOptions;
		this.pauseDurations = pauseDurations;
		this.useDashicons = useDashicons;
		this.controlsElement = null;
		this.currentUtterance = null;

		for ( const method of [ 'play', 'stop', 'next', 'previous', 'updateContainsSelectionState', 'handleEscapeKeydown', 'renderControls' ] ) {
			this[ method ] = this[ method ].bind( this );
		}

		this.state = {
			containsSelection: false,
			settingsShown: false,
			speakTimeoutId: 0, // @todo This can be removed from the state.
			playing: false,
			chunkIndex: 0, // Which chunk is playing.
			chunkRangeOffset: 0, // Which character inside the chunk's nodes was last spoken.
			languageVoices: {},
			pitch: 1.0,
			rate: 1.0,
		};
		Object.assign( this.state, utteranceOptions );
	}

	/**
	 * Initialize.
	 *
	 * See destroy method for inverse.
	 */
	initialize() {
		this.chunkify();
		this.injectControls();
		this.setupStateMachine();

		// @todo Also if focus removed from container?
		document.addEventListener( 'selectionchange', this.updateContainsSelectionState );
		document.addEventListener( 'keydown', this.handleEscapeKeydown );
		this.isDialogSupported = 'showModal' in document.createElement( 'dialog' ) || 'undefined' !== typeof dialogPolyfill;

		this.renderControls();
		this.on( 'change', this.renderControls );

		// @todo Add mutationObserver for this element to call this.chunkify() again.
	}

	/**
	 * Set state.
	 *
	 * @param {Object}  props - Props.
	 * @param {Object}  options - Options.
	 * @param {boolean} options.suppressEvents - Whether to suppress change event.
	 */
	setState( props, { suppressEvents = false } = {} ) {
		const oldProps = this.state;
		const newProps = Object.assign( {}, oldProps, props );
		this.state = newProps;

		let changeCount = 0;

		// @todo Instead of emitting an event, just allow an onChange prop to be sent down, and make use of componentDidUpdate to call.
		for ( const key of Object.keys( props ) ) {
			if ( isEqual( newProps[ key ], oldProps[ key ] ) ) {
				continue;
			}

			if ( ! suppressEvents ) {
				if ( typeof newProps[ key ] === 'string' ) {
					this.emit( 'change:' + key + ':' + newProps[ key ], oldProps[ key ] );
				}
				this.emit( 'change:' + key, newProps[ key ], oldProps[ key ] );
			}
			changeCount += 1;
		}
		if ( ! suppressEvents && changeCount > 0 ) {
			this.emit( 'change', newProps, oldProps );
		}
	}

	/**
	 * Set up state machine.
	 *
	 * @todo This can be handled in componentDidUpdate.
	 */
	setupStateMachine() {
		this.on( 'change:playing', ( playing ) => {
			if ( playing ) {
				this.startPlayingCurrentChunkAndQueueNext();
			} else {
				clearTimeout( this.state.speakTimeoutId );
				speechSynthesis.cancel();
			}
		} );

		this.on( 'change:speakTimeoutId', ( newTimeoutId, oldTimeoutId ) => {
			clearTimeout( oldTimeoutId );
		} );

		const handleChunkChange = () => {
			if ( this.state.playing ) {
				this.startPlayingCurrentChunkAndQueueNext();
			} else {
				const selection = window.getSelection();
				const range = document.createRange();
				const chunk = this.chunks[ this.state.chunkIndex ];
				const firstNode = chunk.nodes[ 0 ];
				const lastNode = chunk.nodes[ chunk.nodes.length - 1 ];
				selection.removeAllRanges();
				range.setStart( firstNode, 0 );
				range.setEnd( lastNode, lastNode.length );
				this.playbackAddedRange = range;
				selection.addRange( range );
				firstNode.parentElement.scrollIntoView( { behavior: 'smooth' } );
			}
		};

		this.on( 'change:containsSelection', ( selected ) => {
			this.controlsElement.classList.toggle( 'spoken-word--active', selected );
		} );

		// Make sure voices get loaded when the settings are shown.
		this.on( 'change:settingsShown', ( isVisible ) => {
			if ( isVisible && ! voices.isLoaded() ) {
				voices.load().then( this.renderControls );
			}
		} );

		const handleVoicePropChangeDuringPlayback = () => {
			if ( this.state.playing ) {
				this.voicePropChanged = true; // Prevent playback from stopping onend.
				this.startPlayingCurrentChunkAndQueueNext();
			}

			this.emit( 'sharedStateChange', {
				languageVoices: this.state.languageVoices,
				rate: this.state.rate,
				pitch: this.state.pitch,
			} );
		};

		this.on( 'change', ( newProps, oldProps ) => {
			if ( newProps.chunkIndex !== oldProps.chunkIndex || newProps.chunkRangeOffset !== oldProps.chunkRangeOffset ) {
				handleChunkChange();
			}
			if (
				newProps.rate !== oldProps.rate ||
				newProps.pitch !== oldProps.pitch ||
				( newProps.languageVoices !== oldProps.languageVoices && ! isEqual( newProps.languageVoices, oldProps.languageVoices ) )
			) {
				handleVoicePropChangeDuringPlayback();
			}
		} );
	}

	/**
	 * Chunkify text nodes in content.
	 */
	chunkify() {
		this.chunks = chunkify( Object.assign(
			{},
			this.chunkifyOptions,
			{ containerElement: this.rootElement }
		) );
	}

	/**
	 * Inject controls into content.
	 */
	injectControls() {
		this.controlsElement = document.createElement( 'div' ); // @todo Check to see if this element is already present, and use merge data-* with props.
		this.controlsElement.classList.add( 'spoken-word' );
		this.rootElement.insertBefore( this.controlsElement, this.rootElement.firstChild );
	}

	/**
	 * Get available voices.
	 *
	 * @returns {SpeechSynthesisVoice[]} Local voices sorted by name.
	 */
	getAvailableVoices() {
		if ( this._availableVoices && this._availableVoices.length > 0 ) {
			return this._availableVoices;
		}
		const availableVoices = speechSynthesis.getVoices().filter( ( voice ) => voice.localService );
		availableVoices.sort( ( a, b ) => {
			if ( a.name === b.name ) {
				return 0;
			}
			return a.name < b.name ? -1 : 1;
		} );

		// Remove duplicate non-premium which can occur in Safari.
		const voiceURIs = new Set( availableVoices.map( ( voice ) => voice.voiceURI ) );
		this._availableVoices = availableVoices.filter( ( voice ) => {
			return voice.voiceURI.endsWith( '.premium' ) || ! voiceURIs.has( voice.voiceURI + '.premium' );
		} );

		return availableVoices;
	}

	/**
	 * Get voice for each language.
	 *
	 * @return {Object<string, string>} Mapping of language to voiceURI.
	 */
	getLanguageVoices() {
		const languageVoices = {};
		for ( const voice of this.getAvailableVoices() ) {
			const lang = voice.lang.replace( /-.*/, '' );
			if ( voice.default || ! ( lang in languageVoices ) ) {
				languageVoices[ lang ] = voice.voiceURI;
			}
		}
		Object.assign( languageVoices, this.state.languageVoices );
		return languageVoices;
	}

	/**
	 * Render controls.
	 */
	renderControls() {
		const weightedLanguages = getWeightedChunkLanguages( this.chunks );
		const presentLanguages = Object.keys( weightedLanguages );
		presentLanguages.sort( ( a, b ) => {
			return weightedLanguages[ b ] - weightedLanguages[ a ];
		} );

		const props = Object.assign(
			{},
			this.state,
			{
				play: this.play,
				stop: this.stop,
				next: this.next,
				previous: this.previous,
				useDashicons: this.useDashicons,
				onShowSettings: () => {
					this.setState( { settingsShown: true } );
				},
				onHideSettings: () => {
					this.setState( { settingsShown: false } );
				},
				presentLanguages,
				availableVoices: this.getAvailableVoices(),
				languageVoices: this.getLanguageVoices(),
				setProps: ( updatedProps ) => {
					this.setState( updatedProps );
				},
				isDialogSupported: this.isDialogSupported,
			}
		);
		render( <PlaybackControls { ...props } />, this.controlsElement );
	}

	/**
	 * Get voice.
	 *
	 * @todo Allow different voices for quotations and headings.
	 * @param {Chunk} chunk - Chunk
	 * @returns {Object} Props for voice, pitch, and rate.
	 */
	getUtteranceOptions( chunk ) {
		const props = {
			pitch: this.state.pitch,
			rate: this.state.rate,
		};
		if ( chunk.language ) {
			props.voice = this.getVoice( chunk );
			props.lang = chunk.language; // @todo This doesn't work at all in Safari.
		}
		return props;
	}

	/**
	 * Get voice for chunk.
	 *
	 * @param {Chunk} chunk - Speech chunk.
	 * @return {SpeechSynthesisVoice|null} Voice.
	 */
	getVoice( chunk ) {
		const languageVoices = this.getLanguageVoices();
		const baseLanguage = chunk.language.replace( /-.*/, '' ).toLowerCase();
		let resultingVoice = speechSynthesis.getVoices().find(
			( voice ) => voice.voiceURI === languageVoices[ baseLanguage ]
		);
		if ( ! resultingVoice ) {
			resultingVoice = speechSynthesis.getVoices().find(
				( voice ) => voice.lang.startsWith( baseLanguage )
			);
		}
		return resultingVoice;
	}

	/**
	 * Speak chunk.
	 *
	 * @returns {Promise} Resolves when completed.
	 */
	speakChunk() {
		const chunkIndex = this.state.chunkIndex;
		return new Promise( ( resolve, reject ) => {
			const chunk = this.chunks[ chunkIndex ];
			if ( ! chunk ) {
				reject();
				return;
			}

			const selection = window.getSelection();
			const range = document.createRange();

			// Obtain the text nodes to read, skipping every chunk node that is completely read and calculating the skip distance.
			let initialSkippedNodesLength = 0;
			const nextNodes = [ ...chunk.nodes ];
			while ( nextNodes[ 0 ] && initialSkippedNodesLength + nextNodes[ 0 ].length < this.state.chunkRangeOffset ) {
				initialSkippedNodesLength += nextNodes.shift().length;
			}

			// Obtain the text to read.
			const firstNodeOffset = this.state.chunkRangeOffset - initialSkippedNodesLength;
			let currentTextNode = nextNodes.shift();
			const text = [
				currentTextNode.nodeValue.substr( firstNodeOffset ),
			].concat(
				nextNodes.map( ( textNode ) => textNode.nodeValue )
			).join( '' );

			if ( ! text.trim() ) {
				resolve();
				return;
			}

			this.currentUtterance = new SpeechSynthesisUtterance( text );
			Object.assign( this.currentUtterance, this.getUtteranceOptions( chunk ) );

			// Make sure the app state matches the utterance state if it gets interacted with directly.
			this.currentUtterance.onpause = () => this.setState( { playing: false } );

			let previousSpokenNodesLength = 0;
			let currentChunkRangeOffset = this.state.chunkRangeOffset;

			/**
			 * On boundary change.
			 *
			 * @param {Event} event - Boundary event.
			 * @param {string} event.name - Type of boundary.
			 * @param {number} event.charIndex - Index in text which is being spoken.
			 * @param {SpeechSynthesisUtterance} event.currentTarget - Current utterance.
			 */
			this.currentUtterance.onboundary = ( event ) => {
				if ( 'word' !== event.name ) {
					return;
				}

				// Keep track of the last word that was spoken.
				currentChunkRangeOffset = initialSkippedNodesLength + firstNodeOffset + event.charIndex;
				this.setState(
					{ chunkRangeOffset: currentChunkRangeOffset },
					{ suppressEvents: true }
				);

				scrollElementIntoViewIfNeeded( currentTextNode.parentElement );

				while ( nextNodes.length && event.charIndex + firstNodeOffset >= previousSpokenNodesLength + currentTextNode.length ) {
					previousSpokenNodesLength += currentTextNode.length;
					currentTextNode = nextNodes.shift();
				}

				// Skip highlighting if settings are shown.
				if ( ! this.state.settingsShown ) {
					const startOffset = event.charIndex - previousSpokenNodesLength + firstNodeOffset;

					// This could be improved to better exclude punctuation, but this is very engine- and language-dependent.
					const currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /\s.+/, '' );

					/*
					 * Note: The token may span text nodes. If currentToken.length > currentTextNode.length then we have to
					 * eventually start looping over nextNodes until we have enough nodes to select. It would be unusual
					 * for a text node to be split in the middle of the word, so this is not currently accounted for.
					 */
					selection.removeAllRanges();
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					this.playbackAddedRange = range;
					selection.addRange( range );
				}
			};

			/**
			 * Resolve or reject the promise when the utterance ends depending on why it ended.
			 */
			const onFinish = () => {
				this.currentUtterance = null;
				if ( ! this.state.settingsShown ) {
					selection.removeAllRanges();
				}

				if ( this.voicePropChanged ) {
					this.voicePropChanged = false;
					reject( 'voice_prop_changed' );
					return;
				}

				if ( this.state.chunkIndex !== chunkIndex ) {
					reject( 'chunk_change' );
					return;
				}

				if ( currentChunkRangeOffset !== this.state.chunkRangeOffset ) {
					reject( 'chunk_change' );
					return;
				}

				if ( ! this.state.playing ) {
					reject( 'playback_stopped' );
					return;
				}

				if ( 0 !== nextNodes.length ) {
					reject( 'playback_interrupted' );
					return;
				}

				resolve();
			};

			this.currentUtterance.onend = onFinish;

			/**
			 * Clear voicePropChanged flag when error event happens in Safari when changing voice during playback.
			 *
			 * Cancelling speech in Safari causes an error event to happen.
			 */
			this.currentUtterance.onerror = () => {
				if ( this.voicePropChanged ) {
					this.voicePropChanged = false;
				}
			};

			speechSynthesis.speak( this.currentUtterance );
		} );
	}

	/**
	 * Get chunk index for the current selected range.
	 *
	 * @param {Range} [range] - Range. Defaults to current selection range.
	 * @returns {Object|null} Chunk index and char offset for current selection, or null if not selected.
	 */
	getChunkPositionFromRange( range = null ) {
		let selectedRange = range;
		if ( ! selectedRange ) {
			const selection = window.getSelection();
			if ( 1 !== selection.rangeCount ) {
				return null;
			}
			selectedRange = selection.getRangeAt( 0 );
		}
		try {
			if ( selectedRange.startContainer.nodeType !== Node.TEXT_NODE ) {
				return null;
			}
		} catch ( e ) {
			return null; // Firefox sometimes errors with Permission denied to access property "nodeType".
		}
		for ( let chunkIndex = 0; chunkIndex < this.chunks.length; chunkIndex++ ) {
			let chunkRangeOffset = 0;
			for ( const node of this.chunks[ chunkIndex ].nodes ) {
				if ( selectedRange.startContainer === node ) {
					chunkRangeOffset += selectedRange.startOffset;
					return { chunkIndex, chunkRangeOffset };
				}
				chunkRangeOffset += node.length;
			}
		}
		return null;
	}

	/**
	 * Update containsSelection state based on whether range is inside of root element; update selected chunk position if user-selected range.
	 */
	updateContainsSelectionState() {
		const selection = window.getSelection();
		if ( 0 !== selection.rangeCount ) {
			const range = selection.getRangeAt( 0 );
			const props = {
				containsSelection: false,
			};
			try {
				// @todo Firefox Permission denied to access property "nodeType"
				props.containsSelection = this.rootElement.contains( range.startContainer ) || this.rootElement.contains( range.endContainer );
			} catch ( e ) {
				// Firefox.
			}

			// Move current playback to newly selected range if not added programmatically.
			if ( this.state.playing && this.playbackAddedRange && ! equalRanges( range, this.playbackAddedRange ) ) {
				const chunkSelection = this.getChunkPositionFromRange( range );
				if ( chunkSelection ) {
					Object.assign( props, chunkSelection );
				}
			}

			this.setState( props );
		}
	}

	/**
	 * Handle keydown event for Escape key press to stop playback (unless the settings are shown, as ESC closes them).
	 *
	 * @param {Event} event - The keydown event.
	 */
	handleEscapeKeydown( event ) {
		if ( this.state.playing && ESCAPE_KEY_CODE === event.which && ! this.state.settingsShown ) {
			this.stop();
		}
	}

	/**
	 * Play content.
	 *
	 * @returns {void}
	 */
	play() {
		const props = {
			playing: true,
		};

		const chunkSelection = this.getChunkPositionFromRange();
		if ( chunkSelection ) {
			Object.assign( props, chunkSelection );
		} else if ( this.state.chunkIndex + 1 === this.chunks.length ) { // @todo This needs to also account for chunkRangeOffset.
			props.chunkIndex = 0;
			props.chunkRangeOffset = 0;
		}
		this.setState( props );
	}

	/**
	 * Get inter-chunk reading pause.
	 *
	 * @param {Chunk} thisChunk - Current chunk.
	 * @param {Chunk} nextChunk - Next chunk.
	 * @return {number} Milliseconds to pause between speaking chunks.
	 */
	getInterChunkPause( thisChunk, nextChunk ) {
		if ( thisChunk.root !== nextChunk.root ) {
			if ( thisChunk.root.matches( HEADING_SELECTOR ) || nextChunk.root.matches( HEADING_SELECTOR ) ) {
				return this.pauseDurations.heading; // @todo Let the heading level also very the pause?
			} else if ( thisChunk.root.matches( PARAGRAPH_PAUSE_SELECTOR ) || nextChunk.root.matches( PARAGRAPH_PAUSE_SELECTOR ) ) {
				return this.pauseDurations.paragraph;
			}
		}
		return 0;
	}

	/**
	 * Start playing current chunk and queue playing the next.
	 */
	startPlayingCurrentChunkAndQueueNext() {
		clearTimeout( this.state.speakTimeoutId );

		const reject = ( reason ) => {
			if ( ! reason || 'playback_interrupted' === reason || 'playback_completed' === reason ) {
				this.setState( { playing: false } );
			}
		};

		const speakingStoppedPromise = new Promise( ( resolve ) => {
			// Wait for cancelled speaking to be confirmed to be ended. Needed in Chrome.
			if ( speechSynthesis.speaking ) {
				const CANCEL_WAIT_TIMEOUT = 100;
				if ( this.currentUtterance ) {
					this.currentUtterance.addEventListener( 'end', resolve );
				}
				setTimeout( () => resolve(), CANCEL_WAIT_TIMEOUT );
				speechSynthesis.cancel();
			} else {
				resolve();
			}
		} );

		const queueNextChunk = () => {
			if ( this.state.chunkIndex + 1 === this.chunks.length ) {
				reject( 'playback_completed' );
				return;
			}

			const thisChunk = this.chunks[ this.state.chunkIndex ];
			const nextChunk = this.chunks[ this.state.chunkIndex + 1 ];
			const pauseDuration = this.getInterChunkPause( thisChunk, nextChunk );
			const currentChunk = this.state.chunkIndex;
			this.setState( {
				speakTimeoutId: setTimeout( () => {
					this.setState( {
						chunkIndex: currentChunk + 1, // This state change will cause startPlayingCurrentChunkAndQueueNext to be called.
						chunkRangeOffset: 0, // Start at beginning of chunk.
					} );
				}, Math.round( pauseDuration * ( 1 / this.state.rate ) ) ),
			} );
		};

		// Make sure voices are loaded and speech synthesis has been completely stopped (since cancel is apparently async).
		Promise.all( [ voices.load(), speakingStoppedPromise ] ).then( () => {
			this.setState( {
				speakTimeoutId: setTimeout( () => {
					this.speakChunk().then( queueNextChunk, reject );
				} ),
			} );
		}, reject );
	}

	/**
	 * Go to previous chunk and play.
	 */
	previous() {
		const props = {
			chunkRangeOffset: 0,
		};

		// Only move to previous chunk if already at beginning of this chunk.
		if ( this.state.chunkRangeOffset < CHUNK_BEGINNING_OFFSET_THRESHOLD ) {
			props.chunkIndex = Math.max( this.state.chunkIndex - 1, 0 );
		}

		this.setState( props );
	}

	/**
	 * Go to next chunk and play, or just stop if at the end.
	 */
	next() {
		if ( this.state.chunkIndex + 1 === this.chunks.length ) {
			return;
		}

		const props = {
			chunkIndex: this.state.chunkIndex + 1,
			chunkRangeOffset: 0,
		};
		this.setState( props );
	}

	/**
	 * Stop speaking utterance.
	 */
	stop() {
		this.setState( { playing: false } );
	}

	/**
	 * Destroy speech.
	 */
	destroy() {
		if ( this.state.playing ) {
			speechSynthesis.cancel();
		}
		document.removeEventListener( 'selectionchange', this.updateContainsSelectionState );
		document.removeEventListener( 'keydown', this.handleEscapeKeydown );
		unmountComponentAtNode( this.controlsElement );
	}
}

EventEmitter( Speech.prototype );
