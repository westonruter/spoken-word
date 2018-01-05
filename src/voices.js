
export const list = [];

const pendingPromiseCallbacks = [];

speechSynthesis.addEventListener( 'voiceschanged', () => {
	list.push( ...speechSynthesis.getVoices() );
	for ( const { resolve, reject } of pendingPromiseCallbacks ) {
		if ( list.length > 0 ) {
			resolve( list );
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
	return list.length > 0;
}

/**
 * Get voices.
 *
 * @returns {Promise} Resolves to list of speechSynthesis voices.
 */
export function load() {
	return new Promise( ( resolve, reject ) => {
		if ( list.length > 0 ) {
			resolve( list );
			return;
		}

		list.push( ...speechSynthesis.getVoices() );
		if ( list.length > 0 ) {
			resolve( list );
		}

		pendingPromiseCallbacks.push( { resolve, reject } );
	} );
}
