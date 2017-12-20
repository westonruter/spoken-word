class Article {
	// @todo Have reference to current utterance.
	// @todo Make sure that when an utterance starts, all other articles in the collection get their utterances paused.
	// @todo Destroy method should stop utterance.


	constructor( { container, voices = [], rate = 1.0, pitch = 1 } ) {
		this.container = container;
		this.voices = voices;
		this.rate = rate;
		this.pitch = pitch;
		this.currentPosition = null;
		this.currentTextNode = null;
		this.currentOffset = null;

		// @todo Translation strings.

		// @todo Voice preferences?
		// @todo Add mutationObserver for this element to
	}

	chunk() {
		// @todo

		// Omit including containers for text nodes that are for image captions or
		// superscripts. Build list of text nodes first, then remove ones that are
		// omitted (consider weak set), and then concatenate for synthesis followed
		// by iteration. Chunk up nodes by language, queue of stuff to read informed
		// by subsequent element to know pause.
	}

	play() {

	}
	pause() {

	}

	destroy() {
		// @todo Tear down mutation observer.
		// @todo Stop uttterance.
	}

	// @todo Add playbackRate prop.
}


module.exports = Article;
