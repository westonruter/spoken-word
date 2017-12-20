/**
 * A segment of text nodes that are to be read by the TTS engine.
 *
 * @typedef {object} Chunk
 * @property {Array}  nodes    - Text nodes.
 * @property {string} language - Language for text nodes.
 * @property
 */

const DEFAULT_ROOT_WHITELIST_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, dt, dd, figcaption';
const DEFAULT_LEAF_BLACKLIST_SELECTOR = 'sup, sub';

/**
 * Find language for element.
 *
 * @param {Element} startElement - Start element.
 * @returns {string|null} Language code or null if no language can be found.
 */
function findLanguage( startElement ) {
	let element = startElement;
	while ( element ) {
		if ( element.language ) {
			return element.language;
		}
		element = element.parentNode;
	}
	return null;
}

/**
 * Omit including containers for text nodes that are for image captions or
 * superscripts. Build list of text nodes first, then remove ones that are
 * omitted (consider weak set), and then concatenate for synthesis followed
 * by iteration. Chunk up nodes by language, queue of stuff to read informed
 * by subsequent element to know pause.
 *
 * @param {Object} args - Arguments
 * @param {Element}         args.containerElement - Container element.
 * @param {string|Function} args.rootIncludeFilter - CSS selector or function which is used to find chunk root elements.
 * @param {string|Function} args.leafExcludeFilter - CSS selector or function which is used to exclude text node parent elements inside chunk roots.
 * @returns {Chunk[]}
 */
export default function chunkify( {
	containerElement,
	rootIncludeFilter = DEFAULT_ROOT_WHITELIST_SELECTOR,
	leafExcludeFilter = DEFAULT_LEAF_BLACKLIST_SELECTOR,
} ) {

	// Make sure filters are functions when selector strings are supplied.
	if ( 'string' === typeof rootIncludeFilter ) {
		const rootIncludeSelector = rootIncludeFilter;
		rootIncludeFilter = ( element ) => element.matches( rootIncludeSelector );
	}
	if ( 'string' === typeof leafExcludeFilter ) {
		const leafExcludeSelector = leafExcludeFilter;
		leafExcludeFilter = ( element ) => element.matches( leafExcludeSelector );
	}

	const chunks = [];
	let currentChunk;

	// @todo Find the root element language.

	// Find all of the text nodes in the container element
	// @todo The following only works when we don't have to split chunks inside of an element. We can't use the tree walker.
	const walker = document.createTreeWalker(
		containerElement,
		NodeFilter.SHOW_ALL,
		{
			acceptNode: ( node ) => {
				if ( node.nodeType === Node.ELEMENT_NODE && leafExcludeFilter( node ) ) {
					return NodeFilter.FILTER_REJECT;
				}
				if ( node.nodeType === Node.TEXT_NODE ) {
					return NodeFilter.FILTER_ACCEPT;
				}
				return NodeFilter.FILTER_SKIP;
			}
		},
		false
	);

	let string = '';

	// @todo Current node is "important" we need to skip: <p>This is <sup>the <b>important</b> thing</sup> hello.</p>
	while ( walker.nextNode() ) {
		string += walker.currentNode.nodeValue;
	}

}
