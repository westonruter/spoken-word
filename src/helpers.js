
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
