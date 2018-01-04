
import React, { render, unmountComponentAtNode } from 'preact-compat';
import EventEmitter from 'event-emitter';

import chunkify from './chunkify';
import * as voices from './voices';
import { equalRanges } from './helpers';
import PlaybackControls from './components/PlaybackControls';

/**
 * A segment of text nodes that are to be read by the TTS engine.
 *
 * @typedef {object} Chunk
 * @property {Array}   nodes    - Text nodes.
 * @property {string}  language - Language for text nodes.
 * @property {Element} root     - Container element, not necessarily the parent.
 */

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const PARAGRAPH_PAUSE_SELECTOR = 'blockquote, p, dt';
const DEFAULT_PAUSE_DURATIONS = {
	heading: 1000,
	paragraph: 500,
};
const CHUNK_BEGINNING_OFFSET_THRESHOLD = 10;

/**
 * @todo Rename to Controller.
 * @class Speech
 * @augments EventEmitter
 */
export default class Speech {
	/**
	 * Construct.
	 *
	 * @param {Object}  args                   - Args.
	 * @param {Element} args.rootElement       - Element.
	 * @param {Array}   args.defaultVoicePrefs - Ordered list of preferred voices.
	 * @param {number}  args.defaultRate       - Default rate.
	 * @param {number}  args.defaultPitch      - Default pitch.
	 * @param {Object}  args.chunkifyOptions   - Chunkify options.
	 * @param {Object}  args.pauseDurations    - Pause durations.
	 */
	constructor( {
		rootElement,
		defaultVoicePrefs = [], // @todo Combine this and the following two into Speech options.
		defaultRate = 1.0,
		defaultPitch = 1.0,
		useDashicons = false,
		chunkifyOptions,
		pauseDurations = DEFAULT_PAUSE_DURATIONS,
	} ) {
		this.rootElement = rootElement;
		this.chunkifyOptions = chunkifyOptions;
		this.useDashicons = useDashicons;
		this.controlsElement = null;
		this.currentUtterance = null;

		for ( const method of [ 'play', 'stop', 'next', 'previous', 'updateContainsSelectionState' ] ) {
			this[ method ] = this[ method ].bind( this );
		}

		this.state = {
			containsSelection: false,
			speakTimeoutId: 0,
			playback: 'stopped',
			chunkIndex: 0, // Which chunk is playing.
			chunkRangeOffset: 0, // Which character inside the chunk's nodes was last spoken.
			voice: '', // @todo Change this to voices, mapping language to voiceURI.
			rate: 1.0,
			pitch: 1.0,
		};

		this.pauseDurations = pauseDurations;
		this.defaultVoicePrefs = defaultVoicePrefs;
		this.defaultRate = defaultRate;
		this.defaultPitch = defaultPitch;

		// @todo Translation strings.
	}

	/**
	 * Initialize.
	 */
	initialize() {
		this.chunkify();
		this.injectControls();
		this.setupStateMachine();

		// @todo Also if focus removed from container?
		document.addEventListener( 'selectionchange', this.updateContainsSelectionState );

		this.renderControls();

		// @todo Add mutationObserver for this element to call this.chunkify() again.
		// @todo Add mutation observer to destroy once this.rootElement is removed.
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

		for ( const key of Object.keys( props ) ) {
			if ( newProps[ key ] === oldProps[ key ] ) {
				continue;
			}

			if ( ! suppressEvents ) {
				if ( typeof newProps[ key ] === 'string' ) {
					this.emit( 'change:' + key + ':' + newProps[ key ], oldProps[ key ] );
				}
				this.emit( 'change:' + key, newProps[ key ], oldProps[ key ] );
			}
		}
		if ( ! suppressEvents ) {
			this.emit( 'change', newProps, oldProps );
		}

		this.renderControls();
	}

	/**
	 * Set up state machine.
	 */
	setupStateMachine() {
		this.on( 'change:playback:stopped', () => {
			speechSynthesis.cancel();
		} );
		this.on( 'change:playback:playing', () => {
			this.startPlayingCurrentChunkAndQueueNext();
		} );

		this.on( 'change:playback', ( newPlayback, oldPlayback ) => {
			if ( 'playing' === oldPlayback ) {
				clearTimeout( this.state.speakTimeoutId );
			}
		} );
		this.on( 'change:speakTimeoutId', ( newTimeoutId, oldTimeoutId ) => {
			clearTimeout( oldTimeoutId );
		} );

		const handleChunkChange = () => {
			if ( 'playing' === this.state.playback ) {
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
			if ( selected ) {
				this.controlsElement.classList.add( 'spoken-word--active' );
			} else {
				this.controlsElement.classList.remove( 'spoken-word--active' );
			}
		} );

		this.on( 'change:chunkIndex', handleChunkChange );
		this.on( 'change:chunkRangeOffset', handleChunkChange );
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
	 * Render controls.
	 */
	renderControls() {
		const props = Object.assign(
			{},
			this.state,
			{
				play: this.play,
				stop: this.stop,
				next: this.next,
				previous: this.previous,
				useDashicons: this.useDashicons,
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
			pitch: this.defaultPitch,
			rate: this.defaultRate,
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
		const baseLanguage = chunk.language.replace( /-.*/, '' ).toLowerCase();
		const localVoices = speechSynthesis.getVoices().filter( ( voice ) => voice.localService );
		if ( localVoices.length === 0 ) {
			return null;
		}
		const languageVoices = localVoices.filter( ( voice ) => voice.lang.toLowerCase().startsWith( baseLanguage ) );
		const defaultVoice = localVoices.find( ( voice ) => voice.default );
		if ( defaultVoice && defaultVoice.lang.toLowerCase().startsWith( baseLanguage ) ) {
			return defaultVoice;
		}

		const sameLanguageBaseVoices = [];
		const identicalLanguageVoices = [];
		for ( const voice of languageVoices ) {
			if ( voice.lang.toLowerCase() === chunk.language ) {
				identicalLanguageVoices.push( voice );
			} else if ( voice.lang.startsWith( baseLanguage ) ) {
				sameLanguageBaseVoices.push( voice );
			}
		}
		if ( identicalLanguageVoices.length > 0 ) {
			return identicalLanguageVoices[ 0 ];
		} else if ( sameLanguageBaseVoices.length > 0 ) {
			return sameLanguageBaseVoices[ 0 ];
		}
		return null;
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

			this.currentUtterance = new SpeechSynthesisUtterance( text );
			Object.assign( this.currentUtterance, this.getUtteranceOptions( chunk ) );

			// Make sure the app state matches the utterance state if it gets interacted with directly.
			this.currentUtterance.onpause = () => this.setState( { playback: 'stopped' } );

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

				while ( nextNodes.length && event.charIndex + firstNodeOffset >= previousSpokenNodesLength + currentTextNode.length ) {
					previousSpokenNodesLength += currentTextNode.length;
					currentTextNode = nextNodes.shift();
				}

				selection.removeAllRanges();

				// Handle hyphenated words and words preceded by punctuation.
				const startOffset = event.charIndex - previousSpokenNodesLength + firstNodeOffset;
				const currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /(\W*\w+)\W.*/, '$1' ); // @todo ñ not matching?

				// @todo The token may span text nodes! If currentToken.length > currentTextNode.length then we have to start looping over nextNodes until we have enough nodes to select.
				// Select the token if it contains a speakable character.
				if ( /\w/.test( currentToken ) ) {
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					this.playbackAddedRange = range;
					selection.addRange( range );
					currentTextNode.parentElement.scrollIntoView( { behavior: 'smooth' } );
				}
			};

			/**
			 * Resolve or reject the promise when the utterance ends depending on why it ended.
			 */
			this.currentUtterance.onend = () => {
				this.currentUtterance = null;
				selection.removeAllRanges();

				if ( this.state.chunkIndex !== chunkIndex ) {
					reject( 'chunk_change' );
					return;
				}

				if ( currentChunkRangeOffset !== this.state.chunkRangeOffset ) {
					reject( 'chunk_change' );
					return;
				}

				if ( 'stopped' === this.state.playback ) {
					reject( 'playback_stopped' );
					return;
				}

				if ( 0 !== nextNodes.length ) {
					reject( 'playback_interrupted' );
					return;
				}

				resolve();
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
		if ( selectedRange.startContainer.nodeType !== Node.TEXT_NODE ) {
			return null;
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
				containsSelection: this.rootElement.contains( range.startContainer ) || this.rootElement.contains( range.endContainer ),
			};

			// Move current playback to newly selected range if not added programmatically.
			if ( 'playing' === this.state.playback && this.playbackAddedRange && ! equalRanges( range, this.playbackAddedRange ) ) {
				const chunkSelection = this.getChunkPositionFromRange( range );
				if ( chunkSelection ) {
					Object.assign( props, chunkSelection );
				}
			}

			this.setState( props );
		}
	}

	/**
	 * Play content.
	 *
	 * @returns {void}
	 */
	play() {
		const props = {
			playback: 'playing',
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
				this.setState( { playback: 'stopped' } );
			}
		};

		// Clear the queue so we can start speaking.
		if ( speechSynthesis.speaking || speechSynthesis.pending ) {
			speechSynthesis.cancel();
		}

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
				}, pauseDuration * this.state.rate ),
			} );
		};

		// Make sure voices are loaded and speech synthesis has been completely stopped (since cancel is apparently async).
		voices.load().then( () => {
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
		this.setState( { playback: 'stopped' } );
	}

	/**
	 * Destroy speech.
	 */
	destroy() {
		if ( 'playing' === this.state.playback ) {
			speechSynthesis.cancel();
		}
		document.removeEventListener( 'selectionchange', this.controlsElement );
		unmountComponentAtNode( this.controlsElement );
		// @todo Tear down mutation observer.
	}
}

EventEmitter( Speech.prototype );
