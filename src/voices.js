
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

// Listen for changes to loaded voices and resolve when non-empty.
speechSynthesis.addEventListener( 'voiceschanged', () => {
	const list = speechSynthesis.getVoices();
	for ( const { resolve, reject } of pendingPromiseCallbacks ) {
		if ( list.length > 0 ) {
			loaded = true;
			resolve();
		} else {
			reject();
		}
	}
} );

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
