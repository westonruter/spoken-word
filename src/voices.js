
/**
 * Pending promise callbacks.
 *
 * @type {Array.<Object>}
 */
const pendingPromiseCallbacks = [];

/**
 * Whether voices have been loaded.
 *
 * @type {boolean}
 */
let loaded = false;

const previousOnVoicesChanged = speechSynthesis.onvoiceschanged;

/*
 * Listen for changes to loaded voices and resolve when non-empty.
 * Note that Safari doesn't yet support speechSynthesis.addEventListener()
 * so that is why setting onvoiceschanged is done here.
 */
speechSynthesis.onvoiceschanged = function( event ) {
	if ( previousOnVoicesChanged ) {
		previousOnVoicesChanged.call( this, event );
	}
	const list = speechSynthesis.getVoices();
	for ( const { resolve, reject } of pendingPromiseCallbacks ) {
		if ( list.length > 0 ) {
			loaded = true;
			resolve();
		} else {
			reject();
		}
	}
};

/**
 * Determine whether list is loaded.
 *
 * @return {boolean} Is loaded.
 */
export function isLoaded() {
	return loaded;
}

/**
 * Get voices.
 *
 * @returns {Promise} Resolves to list of speechSynthesis voices.
 */
export function load() {
	return new Promise( ( resolve, reject ) => {
		const list = speechSynthesis.getVoices();

		if ( list.length > 0 ) {
			loaded = true;
			resolve();
			return;
		}

		pendingPromiseCallbacks.push( { resolve, reject } );
	} );
}
