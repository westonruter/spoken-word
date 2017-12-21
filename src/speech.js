
import chunkify from './chunkify';

export default class Speech {

	// @todo Have reference to current utterance.
	// @todo Make sure that when an utterance starts, all other articles in the collection get their utterances paused.
	// @todo Destroy method should stop utterance.

	constructor({
		rootElement,
		defaultVoicePrefs = [],
		defaultRate = 1.0,
		defaultPitch = 1.0,
		chunkifyOptions
	}) {
		this.rootElement = rootElement;
		this.defaultVoicePrefs = defaultVoicePrefs;
		this.defaultRate = defaultRate;
		this.defaultPitch = defaultPitch;
		this.chunkifyOptions = chunkifyOptions;

		this.state = 'stopped'; // @todo This should emit events for collection to list to.
		this.currentChunk = 0;
		this.currentUtterance = null;

		// Eliminate.
		this.currentPosition = null;
		this.currentTextNode = null;
		this.currentOffset = null;

		// Probably a bug in Chrome that utterance is not canceled upon unload.
		window.addEventListener( 'unload', () => {
			this.stop();
		});

		this.chunkify();

		// @todo Translation strings.
		// @todo Voice preferences?
		// @todo Add mutationObserver for this element to call this.chunkify() again.
	}

	chunkify() {
		this.chunks = chunkify( Object.assign(
			{},
			this.chunkifyOptions,
			{ containerElement: this.rootElement }
		) );
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

		if ( this.currentChunk >= this.chunks.length ) {
			this.currentChunk = 0;
		}

		const reject = () => {}

		const speakNextChunk = () => {
			// @todo Decide on the delay depending on what the chunk root is.

			this.currentChunk += 1;

			if ( this.currentChunk === this.chunks.length ) {
				this.state = 'stopped';
			} else {
				this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
			}
		}
		this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
	}

	/**
	 * Speak chunk.
	 *
	 * @param {number} chunkIndex - Chunk index.
	 * @returns {Promise} Resolves when completed.
	 */
	speakChunk( chunkIndex ) {
		return new Promise( ( resolve, reject ) => {
			const chunk = this.chunks[ this.currentChunk ];
			if ( ! chunk ) {
				reject();
				return;
			}
			this.rejectSpeakChunk = reject;
			const text = chunk.nodes.map( ( textNode ) => textNode.nodeValue ).join( '' );
			const selection = window.getSelection();
			const range = document.createRange();
			let previousNodesOffset = 0;

			this.currentUtterance = new SpeechSynthesisUtterance( text );
			this.currentUtterance.pitch = this.defaultPitch;
			this.currentUtterance.rate = this.defaultRate;

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
				let startOffset = event.charIndex - previousNodesOffset;

				// Handle case when resuming (sometimes).
				if ( startOffset < 0 ) {
					return;
				}

				let currentToken = event.currentTarget.text.substr( event.charIndex ).replace( /\W.*/, '' );
				selection.removeAllRanges();

				if ( /\w/.test( currentToken ) ) {
					range.setStart( currentTextNode, startOffset );
					range.setEnd( currentTextNode, Math.min( startOffset + currentToken.length, currentTextNode.length ) );
					selection.addRange( range );
				}
			};

			this.currentUtterance.onend = () => {
				this.currentUtterance = null;
				this.rejectSpeakChunk = null;
				selection.removeAllRanges();
				resolve();
			};

			speechSynthesis.speak( this.currentUtterance );
		});
	}

	pause() {
		if ( this.currentUtterance ) {
			this.state = 'paused';
			speechSynthesis.pause( this.currentUtterance );
		}
	}

	previous() {
		this.stop();
		this.currentChunk = Math.max( this.currentChunk - 2, 0 ); // @todo Index diff verify.
		this.play();
	}

	next() {
		this.stop();
		this.currentChunk++;
		if ( this.currentChunk >= this.chunks.length ) {
			this.currentChunk = 0;
		} else {
			this.play();
		}
	}

	resume() {
		this.state = 'playing';
		if ( this.currentUtterance ) {
			speechSynthesis.resume( this.currentUtterance );
		}
	}

	stop() {
		this.state = 'stopped';
		if ( this.currentUtterance ) {
			if ( this.rejectSpeakChunk ) {
				this.rejectSpeakChunk();
			}
			speechSynthesis.cancel( this.currentUtterance );
			this.currentUtterance = null;
		}
	}

	destroy() {
		// @todo Tear down mutation observer.
		// @todo Stop uttterance.
	}

	// @todo Add playbackRate prop.
}
