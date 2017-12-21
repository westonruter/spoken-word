
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
	 * @returns {Promise} Resolves when playback finishes. Rejects if playback is interrupted.
	 */
	play() {
		return new Promise( ( resolve, reject ) => {
			if ( this.currentChunk >= this.chunks.length ) {
				this.currentChunk = 0;
			}
			const speakNextChunk = () => {
				// @todo Decide on the delay depending on what the chunk root is.

				this.currentChunk += 1;

				console.info( 'speakChunk', this.currentChunk );
				if ( this.currentChunk === this.chunks.length ) {
					resolve();
				} else {
					this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
				}
			}
			this.speakChunk( this.currentChunk ).then( speakNextChunk, reject );
		});
	}

	/**
	 * Speak chunk.
	 *
	 * @param {number} chunkIndex - Chunk index.
	 * @returns {Promise} Resolves when completed.
	 */
	speakChunk( chunkIndex ) {
		return new Promise( ( resolve ) => {
			const chunk = this.chunks[ this.currentChunk ];
			const text = chunk.nodes.map( ( textNode ) => textNode.nodeValue ).join( '' );
			const selection = window.getSelection();
			const range = document.createRange();
			let previousNodesOffset = 0;

			this.currentUtterance = new SpeechSynthesisUtterance( text );
			this.currentUtterance.pitch = this.defaultPitch;
			this.currentUtterance.rate = this.defaultRate;

			// Will pause cause it to onend?
			this.currentUtterance.onend = () => {
				resolve();
			};
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

				// Handle case when resuming.
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

			speechSynthesis.speak( this.currentUtterance );
		});
	}

	pause() {
		if ( this.currentUtterance ) {
			speechSynthesis.pause( this.currentUtterance );
		}
	}

	resume() {
		if ( this.currentUtterance ) {
			speechSynthesis.resume( this.currentUtterance );
		}
	}

	stop() {
		if ( this.currentUtterance ) {
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
