
/**
 * Compare if two ranges have the same containers and offsets.
 *
 * @param {Range} range1 - First range.
 * @param {Range} range2 - Second range.
 * @return {boolean} Whether same.
 */
export function equalRanges( range1, range2 ) {
	return (
		range1.startContainer === range2.startContainer &&
		range1.startOffset === range2.startOffset &&
		range1.endContainer === range2.endContainer &&
		range1.endOffset === range2.endOffset
	);
}

let lastId = 0;

/**
 * Generate unique (auto-incremented) ID.
 *
 * @return {number} ID.
 */
export function uniqueId() {
	lastId++;
	return lastId;
}

/**
 * Scroll element into view if needed.
 *
 * @param {Element} element - Element to scroll into view.
 * @returns {bool} Whether the element was scrolled into view.
 */
export function scrollElementIntoViewIfNeeded( element ) {
	const clientBoundingRect = element.getBoundingClientRect();
	const isVisible = (
		clientBoundingRect.top >= 0 &&
		clientBoundingRect.left >= 0 &&
		clientBoundingRect.bottom <= document.documentElement.clientHeight &&
		clientBoundingRect.right <= document.documentElement.clientWidth
	);
	if ( ! isVisible ) {
		element.scrollIntoView( {
			behavior: 'smooth',
			block: clientBoundingRect.top < 0 ? 'start' : 'end',
		} );
		return true;
	}
	return false;
}
