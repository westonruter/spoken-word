

export const list = [];

const pendingPromiseCallbacks = [];
const previousOnVoicesChanged = speechSynthesis.onvoiceschanged;

/**
 * Handle voiceschanged.
 */
speechSynthesis.onvoiceschanged = function( ...args ) {
	if ( previousOnVoicesChanged ) {
		previousOnVoicesChanged.call( speechSynthesis, ...args );
	}
	list.push( ...speechSynthesis.getVoices() );
	for ( const { resolve, reject } of pendingPromiseCallbacks ) {
		if ( list.length > 0 ) {
			resolve( list );
		} else {
			reject();
		}
	}
};

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
