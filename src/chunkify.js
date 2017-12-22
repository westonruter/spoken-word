/**
 * A segment of text nodes that are to be read by the TTS engine.
 *
 * @typedef {object} Chunk
 * @property {Array}   nodes    - Text nodes.
 * @property {string}  language - Language for text nodes.
 * @property {Element} root     - Container element.
 */

const DEFAULT_ROOT_WHITELIST_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, q, dt, dd, figcaption';
const DEFAULT_LEAF_BLACKLIST_SELECTOR = 'sup, sub';

/**
 * Find language for element.
 *
 * @param {Element} startElement - Start element.
 * @returns {string|null} Language code or null if no language can be found.
 */
function findLanguage( startElement ) {
	let element = startElement;
	while ( element && element.nodeType === Node.ELEMENT_NODE ) {
		if ( element.lang ) {
			return element.lang.toLowerCase();
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
 * @param {Object}          args                        - Arguments
 * @param {Element}         args.containerElement       - Container element.
 * @param {string|Function} args.chunkRootIncludeFilter - CSS selector or function which is used to find chunk root elements.
 * @param {string|Function} args.chunkLeafExcludeFilter - CSS selector or function which is used to exclude text node parent elements inside chunk roots.
 * @returns {Chunk[]} Chunks.
 */
export default function chunkify( {
	containerElement,
	chunkRootIncludeFilter = DEFAULT_ROOT_WHITELIST_SELECTOR,
	chunkLeafExcludeFilter = DEFAULT_LEAF_BLACKLIST_SELECTOR,
} ) {
	let rootIncludeFilter = chunkRootIncludeFilter;
	let leafExcludeFilter = chunkLeafExcludeFilter;

	// Make sure filters are functions when selector strings are supplied.
	if ( 'string' === typeof rootIncludeFilter ) {
		const rootIncludeSelector = rootIncludeFilter;
		rootIncludeFilter = ( element ) => element.matches( rootIncludeSelector );
	}
	if ( 'string' === typeof leafExcludeFilter ) {
		const leafExcludeSelector = leafExcludeFilter;
		leafExcludeFilter = ( element ) => element.matches( leafExcludeSelector );
	}

	/**
	 * Chunks.
	 *
	 * @type {Chunk[]}
	 */
	const chunks = [];

	/**
	 * Root element stack.
	 *
	 * @type {Element[]}
	 */
	const rootElementStack = [];

	/**
	 * Add chunk text node.
	 *
	 * @param {Node}   textNode - Text node.
	 * @param {string} language - Language.
	 * @returns {void}
	 */
	const addChunkNode = ( textNode, language ) => {
		// Skip nodes that don't contain words.
		if ( ! /\w/.test( textNode.nodeValue ) ) {
			return;
		}

		const root = rootElementStack[ rootElementStack.length - 1 ];
		if ( ! root ) {
			return;
		}
		let currentChunk = chunks[ chunks.length - 1 ];
		if ( ! currentChunk || currentChunk.language !== language || root !== currentChunk.root ) {
			currentChunk = {
				language,
				nodes: [],
				root,
			};
			chunks.push( currentChunk );
		}
		currentChunk.nodes.push( textNode );
	};

	/**
	 * Process element.
	 *
	 * @param {Element} element - DOM Element.
	 * @returns {void}
	 */
	const processElement = ( element ) => {
		const elementLanguage = findLanguage( element );
		const isRootChunkElement = rootIncludeFilter( element );
		if ( isRootChunkElement ) {
			rootElementStack.push( element );
		}

		for ( const childNode of element.childNodes ) {
			switch ( childNode.nodeType ) {
				case Node.ELEMENT_NODE:
					if ( ! leafExcludeFilter( childNode ) ) {
						processElement( childNode );
					}
					break;
				case Node.TEXT_NODE:
					if ( 0 !== rootElementStack.length ) {
						addChunkNode( childNode, elementLanguage );
					}
					break;
				default:
					break;
			}
		}

		if ( isRootChunkElement ) {
			rootElementStack.pop();
		}
	};

	processElement( containerElement );

	return chunks;
}
