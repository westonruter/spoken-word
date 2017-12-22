
import chunkify from './chunkify';
import * as voices from './voices';

// @todo Rename to Controller?
export default class Speech {
	// @todo Have reference to current utterance.
	// @todo Make sure that when an utterance starts, all other articles in the collection get their utterances paused.
	// @todo Destroy method should stop utterance.

	/**
	 * Comnstruct.
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
		this.defaultVoicePrefs = defaultVoicePrefs;
		this.defaultRate = defaultRate;
		this.defaultPitch = defaultPitch;
		this.chunkifyOptions = chunkifyOptions;
		this.controlsElement = null;
		this.controlButtons = {};
		this.playNextTimeoutId = 0;

		this.state = 'stopped'; // @todo This should emit events for collection to list to.
		this.currentChunk = 0;
		this.currentUtterance = null;

		// @todo Translation strings.
		// @todo Voice preferences?
		// @todo Add mutationObserver for this element to call this.chunkify() again.
	}

	/**
	 * Initialize.
	 */
	init() {
		this.chunkify();
		this.setupControls();
		this.injectControls();
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
	 * @param {Chunk} chunk      - Chunk
	 * @returns {Object} Props for voice, pitch, and rate.
	 */
	getUtteranceOptions( chunk ) {
		const props = {
			pitch: this.defaultPitch,
			rate: this.defaultRate,
		};
		if ( chunk.language ) {
			props.voice = this.getVoice( chunk );
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

			this.currentUtterance = new SpeechSynthesisUtterance( text );
			Object.assign( this.currentUtterance, this.getUtteranceOptions( chunk ) );

			const nextNodes = [ ...chunk.nodes ];
			let currentTextNode = nextNodes.shift();
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
				if ( 'stopped' === this.state ) {
					reject();
				} else {
					resolve();
				}
				this.currentUtterance = null;
				selection.removeAllRanges();
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
		if ( 'paused' === this.state ) {
			this.resume();
			return;
		}
		this.state = 'playing';
		this.controlsElement.style.position = 'sticky';
		this.controlsElement.style.top = 0;

		if ( this.currentChunk >= this.chunks.length ) {
			this.currentChunk = 0;
		}

		const reject = () => {
			this.stop();
		};

		const speakNextChunk = () => {
			// @todo Decide on the delay depending on what the chunk root is.

			// @todo Add setTimeout delay and store in playNextTimeoutId.
			this.currentChunk += 1;

			if ( this.currentChunk === this.chunks.length ) {
				this.stop();
			} else {
				this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
			}
		};
		voices.load().then( () => {
			this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
		}, reject );
	}

	/**
	 * Pause utterance.
	 */
	pause() {
		if ( this.currentUtterance ) {
			this.state = 'paused';
			speechSynthesis.pause();
		}
	}

	/**
	 * Resume playing.
	 */
	resume() {
		if ( this.currentUtterance ) {
			this.state = 'playing';
			speechSynthesis.resume();
		}
	}

	/**
	 * Stop playing and then play when it has stopped.
	 *
	 * This is needed to deal with some asynchronous issues with playing when another utterance is being spoken.
	 */
	stopThenPlay() {
		if ( 'playing' === this.state ) {
			const utterance = this.currentUtterance;
			const playNext = () => {
				utterance.removeEventListener( 'end', playNext );
				this.play();
			};
			utterance.addEventListener( 'end', playNext );

			// De-duplicate with stop() method.
			this.state = 'stopped';
			clearTimeout( this.playNextTimeoutId );
			speechSynthesis.cancel();
		} else {
			this.play();
		}
	}

	/**
	 * Go to previous chunk and play.
	 */
	previous() {
		this.currentChunk = Math.max( this.currentChunk - 1, 0 );
		this.stopThenPlay();
	}

	/**
	 * Go to next chunk and play, or just stop if at the end.
	 */
	next() {
		this.currentChunk++;
		if ( this.currentChunk >= this.chunks.length ) {
			this.stop();
		} else {
			this.stopThenPlay();
		}
	}

	/**
	 * Stop speaking utterance.
	 */
	stop() {
		this.state = 'stopped';
		this.controlsElement.style.position = '';
		if ( this.currentUtterance ) {
			this.currentUtterance = null;
			speechSynthesis.cancel();
		}
		clearTimeout( this.playNextTimeoutId );
	}

	/**
	 * Destroy speech.
	 */
	destroy() {
		// @todo Tear down mutation observer.
		// @todo Stop uttterance.
	}
}
