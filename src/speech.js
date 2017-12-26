
import EventEmitter from 'event-emitter';

import chunkify from './chunkify';
import * as voices from './voices';

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
	 * @param {Element} rootElement       - Element.
	 * @param {Array}   defaultVoicePrefs - Ordered list of preferred voices.
	 * @param {number}  defaultRate       - Default rate.
	 * @param {number}  defaultPitch      - Default pitch.
	 * @param {Object}  chunkifyOptions   - Chunkify options.
	 */
	constructor( {
		rootElement,
		defaultVoicePrefs = [], // @todo Combine this and the following two into Speech options.
		defaultRate = 1.0,
		defaultPitch = 1.0,
		chunkifyOptions,
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

				const selection = window.getSelection();
				const range = document.createRange();
				const chunk = this.chunks[ this.state.chunk ];
				const firstNode = chunk.nodes[ 0 ];
				const lastNode = chunk.nodes[ chunk.nodes.length - 1 ];
				selection.removeAllRanges();
				range.setStart( firstNode, 0 );
				range.setEnd( lastNode, lastNode.length );
				selection.addRange( range );

				// @todo Highlight chunk?
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
	 * Play content.
	 *
	 * @returns {void}
	 */
	play() {
		const props = {
			playback: 'playing',
		};
		if ( this.state.chunk + 1 === this.chunks.length ) {
			props.chunk = 0;
		}
		this.setState( props );
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

			const currentChunk = this.state.chunk;
			this.setState( {
				speakTimeoutId: setTimeout( () => {
					this.setState( {
						chunk: currentChunk + 1, // This state change will cause startPlayingCurrentChunkAndQueueNext to be called.
					} );
				} ), // @todo Let delay be variable depending on what the chunk root is.
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
