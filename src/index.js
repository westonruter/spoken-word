
import Speech from './speech';

/**
 *
 *
 * @var {Speech[]}
 */
export const speeches = [];

// @todo Add WeakMap

const CONTENT_SELECTOR = '.hentry .entry-content, .h-entry .e-content, [itemprop="articleBody"]';

/**
 * Find article roots.
 *
 * @param {Element} root     - Root element.
 * @param {string}  selector - Selector.
 * @returns {Array} Article roots.
 */
function findContentRoots( root, selector ) {
	if ( root.matches( selector ) ) {
		return [ root ];
	}

	// @todo What about nested content?
	return [ ...root.querySelectorAll( selector ) ];
}

/**
 * Initialize.
 *
 * @todo Params for patch, rate, voices.
 * @param {Object} options - Options.
 * @param {string} options.speechContentSelector - CSS Selector to find the elements for speaking.
 * @param {Object} options.chunkifyOptions       - Options passed into chunkify.
 * @param {number} options.defaultRate           - Default rate.
 * @param {number} options.defaultPitch          - Default pitch.
 * @param {Array}  options.defaultVoicePrefs     - Default voice preferences.
 * @returns {Promise} Promise.
 */
export function init( {
	rootElement,
	speechContentSelector = CONTENT_SELECTOR,
	chunkifyOptions,
	defaultRate = 1.0, // @todo The options should really be stored globally, not just on a given site.
	defaultPitch = 1.0,
	defaultVoicePrefs,
} = {} ) {
	return new Promise( ( resolve ) => {
		const element = rootElement || document.body;
		const uponReady = () => {
			const speechRoots = findContentRoots( element, speechContentSelector );

			// Probably a bug in Chrome that utterance is not canceled upon unload.
			window.addEventListener( 'unload', () => {
				speechSynthesis.cancel();
			} );

			for ( const speechRoot of speechRoots ) {
				const speech = new Speech( {
					rootElement: speechRoot,
					chunkifyOptions,
					defaultRate,
					defaultPitch,
					defaultVoicePrefs,
				} );
				speeches.push( speech );

				// Stop playing all other speeches when playing one.
				speech.on( 'change:playback:playing', () => {
					for ( const otherSpeech of speeches ) {
						if ( otherSpeech !== speech ) {
							otherSpeech.stop(); // @todo Warning: This may end up stopping this from playing. We can start playback after 100ms.
						}
					}
				} );

				speech.initialize();
			}

			// @todo Add mutation observer to add new article roots dynamically.
			resolve();
		};

		if ( 'complete' === document.readyState || 'interactive' === document.readyState ) {
			uponReady();
		} else {
			document.addEventListener( 'DOMContentLoaded', uponReady );
		}
	} );
}

// @todo Identify articles on DOM load and on Mutation Event.
