
import EventEmitter from 'event-emitter';

import chunkify from './chunkify';
import * as voices from './voices';

/**
 * A segment of text nodes that are to be read by the TTS engine.
 *
 * @typedef {object} Chunk
 * @property {Array}   nodes    - Text nodes.
 * @property {string}  language - Language for text nodes.
 * @property {Element} root     - Container element.
 */

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const PARAGRAPH_PAUSE_SELECTOR = 'blockquote, p, dt';
const DEFAULT_PAUSE_DURATIONS = {
	heading: 1000,
	paragraph: 500,
};

/**
 * @class Speech
 * @augments EventEmitter
 */
export default class Speech {
	// @todo Have reference to current utterance.
	// @todo Make sure that when an utterance starts, all other articles in the collection get their utterances paused.
	// @todo Destroy method should stop utterance.

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
		chunkifyOptions,
		pauseDurations = DEFAULT_PAUSE_DURATIONS,
	} ) {
		this.rootElement = rootElement;
		this.chunkifyOptions = chunkifyOptions;
		this.controlsElement = null;
		this.controlButtons = {};
		this.currentUtterance = null;

		this.state = {
			speakTimeoutId: 0,
			playback: 'stopped',
			chunk: 0,
			voice: '',
			rate: 1.0,
			pitch: 1.0,
		};

		this.pauseDurations = pauseDurations;
		this.defaultVoicePrefs = defaultVoicePrefs;
		this.defaultRate = defaultRate;
		this.defaultPitch = defaultPitch;

		// @todo Translation strings.
		// @todo Voice preferences?
		// @todo Add mutationObserver for this element to call this.chunkify() again.
	}

	/**
	 * Set state.
	 *
	 * @param {Object} props - Props.
	 */
	setState( props ) {
		const oldProps = this.state;
		const newProps = Object.assign( {}, oldProps, props );
		this.state = newProps;

		for ( const key of Object.keys( props ) ) {
			if ( newProps[ key ] === oldProps[ key ] ) {
				continue;
			}

			if ( typeof newProps[ key ] === 'string' ) {
				this.emit( 'change:' + key + ':' + newProps[ key ], oldProps[ key ] );
			}
			this.emit( 'change:' + key, newProps[ key ], oldProps[ key ] );
		}
		this.emit( 'change', newProps, oldProps );
	}

	/**
	 * Set up state machine.
	 */
	setupStateMachine() {
		this.on( 'change:playback:stopped', () => {
			speechSynthesis.cancel();
		} );
		this.on( 'change:playback:paused', () => {
			speechSynthesis.pause();
		} );
		this.on( 'change:playback:playing', ( previousState ) => {
			if ( 'paused' === previousState ) {
				speechSynthesis.resume();
			} else {
				this.startPlayingCurrentChunkAndQueueNext();
			}
		} );

		this.on( 'change:playback', ( newPlayback, oldPlayback ) => {
			if ( 'playing' === oldPlayback ) {
				clearTimeout( this.state.speakTimeoutId );
			}
		} );
		this.on( 'change:speakTimeoutId', ( newTimeoutId, oldTimeoutId ) => {
			clearTimeout( oldTimeoutId );
		} );

		this.on( 'change:chunk', () => {
			if ( 'playing' === this.state.playback ) {
				// Clear the queue so we can star speaking.
				if ( speechSynthesis.speaking || speechSynthesis.pending ) {
					speechSynthesis.cancel();
				}

				// Make sure speech synthesis has been completely stopped.
				this.setState( {
					speakTimeoutId: setTimeout( () => {
						this.startPlayingCurrentChunkAndQueueNext();
					} ),
				} );
			} else {
				// Select the entire chunk instead of speaking it.
				const selection = window.getSelection();
				const range = document.createRange();
				const chunk = this.chunks[ this.state.chunk ];
				const firstNode = chunk.nodes[ 0 ];
				const lastNode = chunk.nodes[ chunk.nodes.length - 1 ];
				selection.removeAllRanges();
				range.setStart( firstNode, 0 );
				range.setEnd( lastNode, lastNode.length );
				selection.addRange( range );
			}
		} );
	}

	/**
	 * Initialize.
	 */
	init() {
		this.chunkify();
		this.setupControls();
		this.injectControls();
		this.setupStateMachine();
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
	 * Setup controls.
	 */
	setupControls() {
		const container = document.createElement( 'fieldset' );

		const legend = document.createElement( 'legend' );
		legend.appendChild( document.createTextNode( 'Speak' ) );
		container.appendChild( legend );

		// @todo The buttons need to by styled according to the current state.
		// @todo The following buttons should not all be displayed and/or enabled at a time.
		this.controlButtons.play = this.createButton( '▶', 'Play' );
		container.appendChild( this.controlButtons.play );

		this.controlButtons.previous = this.createButton( '⏪', 'Previous' );
		container.appendChild( this.controlButtons.previous );

		this.controlButtons.pause = this.createButton( '⏸️', 'Pause' );
		container.appendChild( this.controlButtons.pause );

		this.controlButtons.resume = this.createButton( '⏯️', 'Resume' );
		container.appendChild( this.controlButtons.resume );

		this.controlButtons.next = this.createButton( '⏩', 'Next' );
		container.appendChild( this.controlButtons.next );

		this.controlButtons.stop = this.createButton( '⏹', 'Stop' );
		container.appendChild( this.controlButtons.stop );

		// @todo Should this be a dialog?
		this.controlButtons.settings = this.createButton( '⚙️', 'Settings' );
		container.appendChild( this.controlButtons.settings );
		const dialog = document.createElement( 'dialog' );
		dialog.innerHTML = '<p>Hello world!</p>';
		container.appendChild( dialog );
		this.controlButtons.settings.addEventListener( 'click', () => {
			// @todo Lazy-load dialogPolyfill.
			dialog.showModal();
		} );

		[ 'play', 'previous', 'pause', 'resume', 'next', 'stop' ].forEach( ( id ) => {
			this.controlButtons[ id ].addEventListener( 'click', this[ id ].bind( this ) );
		} );

		// Keep the controls in view when playing.
		this.on( 'change:playback', ( value ) => {
			if ( 'stopped' === value ) {
				container.style.position = '';
			} else {
				container.style.position = 'sticky';
				container.style.top = 0;
			}
		} );

		this.controlsElement = container;
	}

	/**
	 * Create button.
	 *
	 * @todo Styles should not be inline; bookmarklet can load external stylesheet.
	 * @param {string} icon  - Emoji icon.
	 * @param {string} label - Label for button.
	 * @returns {Element} Button.
	 */
	createButton( icon, label ) {
		const button = document.createElement( 'button' );
		button.type = 'button';
		button.appendChild( document.createTextNode( icon ) );
		button.setAttribute( 'aria-label', label );
		button.style.fontFamily = '"Apple Color Emoji","Segoe UI Emoji","NotoColorEmoji","Segoe UI Symbol","Android Emoji","EmojiSymbols"';
		button.style.background = 'none';
		button.style.border = 'none';
		button.style.cursor = 'pointer';
		return button;
	}

	/**
	 * Inject controls into content.
	 */
	injectControls() {
		this.rootElement.insertBefore( this.controlsElement, this.rootElement.firstChild );
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
	 * @param {number} chunkIndex - Chunk index.
	 * @returns {Promise} Resolves when completed.
	 */
	speakChunk( chunkIndex ) {
		return new Promise( ( resolve, reject ) => {
			const chunk = this.chunks[ chunkIndex ];
			if ( ! chunk ) {
				reject();
				return;
			}

			const text = chunk.nodes.map( ( textNode ) => textNode.nodeValue ).join( '' );
			const selection = window.getSelection();
			const range = document.createRange();
			let previousNodesOffset = 0;
			const nextNodes = [ ...chunk.nodes ];
			let currentTextNode = nextNodes.shift();

			// @todo Re-use same utterance once Firefox and Safari support changing SpeechSynthesisVoice.lang dynamically (or at all).
			this.currentUtterance = new SpeechSynthesisUtterance( text );
			Object.assign( this.currentUtterance, this.getUtteranceOptions( chunk ) );

			// Make sure the app state matches the utterance state if it gets interacted with directly.
			this.currentUtterance.onpause = () => this.setState( { playback: 'paused' } );
			this.currentUtterance.onresume = () => this.setState( { playback: 'playing' } );

			this.currentUtterance.onboundary = ( event ) => {
				if ( 'word' !== event.name ) {
					return;
				}
				if ( event.charIndex >= previousNodesOffset + currentTextNode.length ) {
					previousNodesOffset += currentTextNode.length;
					currentTextNode = nextNodes.shift();
				}
				const startOffset = event.charIndex - previousNodesOffset;

				// Handle case when resuming (sometimes).
				if ( startOffset < 0 ) {
					return;
				}

				const currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /\W.*/, '' );
				selection.removeAllRanges();

				// Select the token if it contains a speakable character.
				if ( /\w/.test( currentToken ) ) {
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					selection.addRange( range );
				}
			};

			this.currentUtterance.onend = () => {
				this.currentUtterance = null;
				selection.removeAllRanges();

				if ( this.state.chunk !== chunkIndex ) {
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
	 * @todo Return the offset as well so that speech can start at the selected point.
	 * @todo Consider stopping playback when selectionchange happens.
	 * @returns {number|null} Chunk index for current selection, or null if not selected.
	 */
	getSelectedRangeChunkIndex() {
		const selection = window.getSelection();
		if ( 1 !== selection.rangeCount ) {
			return null;
		}
		const range = selection.getRangeAt( 0 );
		if ( range.isCollapsed ) {
			return null;
		}
		if ( range.startContainer.nodeType !== Node.TEXT_NODE ) {
			return null;
		}
		for ( let i = 0; i < this.chunks.length; i++ ) {
			if ( this.chunks[ i ].nodes.includes( range.startContainer ) ) {
				return i;
			}
		}
		return null;
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

		const selectedRangeChunkIndex = this.getSelectedRangeChunkIndex();
		if ( null !== selectedRangeChunkIndex ) {
			props.chunk = selectedRangeChunkIndex;
		} else if ( this.state.chunk + 1 === this.chunks.length ) {
			props.chunk = 0;
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
		const reject = ( reason ) => {
			if ( ! reason || 'playback_interrupted' === reason || 'playback_completed' === reason ) {
				this.setState( { playback: 'stopped' } );
			}
		};

		const queueNextChunk = () => {
			if ( this.state.chunk + 1 === this.chunks.length ) {
				reject( 'playback_completed' );
				return;
			}

			const thisChunk = this.chunks[ this.state.chunk ];
			const nextChunk = this.chunks[ this.state.chunk + 1 ];
			const pauseDuration = this.getInterChunkPause( thisChunk, nextChunk );
			const currentChunk = this.state.chunk;
			this.setState( {
				speakTimeoutId: setTimeout( () => {
					this.setState( {
						chunk: currentChunk + 1, // This state change will cause startPlayingCurrentChunkAndQueueNext to be called.
					} );
				}, pauseDuration * this.state.rate ),
			} );
		};

		voices.load().then( () => {
			this.speakChunk( this.state.chunk ).then( queueNextChunk, reject );
		}, reject );
	}

	/**
	 * Pause utterance.
	 */
	pause() {
		this.setState( { playback: 'paused' } );
	}

	/**
	 * Resume playing.
	 */
	resume() {
		this.play();
	}

	/**
	 * Go to previous chunk and play.
	 */
	previous() {
		const props = {
			chunk: Math.max( this.state.chunk - 1, 0 ),
		};
		if ( 'paused' === this.state.playback ) {
			props.playback = 'playing';
		}
		this.setState( props );
	}

	/**
	 * Go to next chunk and play, or just stop if at the end.
	 */
	next() {
		const props = {
			chunk: Math.min( this.state.chunk + 1, this.chunks.length - 1 ),
		};
		if ( 'paused' === this.state.playback ) {
			props.playback = 'playing';
		}
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
		// @todo Tear down mutation observer.
		// @todo Stop uttterance.
	}
}

EventEmitter( Speech.prototype );
