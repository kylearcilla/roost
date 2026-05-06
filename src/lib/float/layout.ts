/**
 * Keeps a floating box inside the viewport, anchored to cursor position.
 */
export function initFloatElemPos(context: {
	dims: BoxSize
	cursorPos: OffsetPoint
	containerDims: BoxSize
	clientOffset?: OffsetPoint
	margins?: { ns: number; ew: number }
}) {
	const {
		dims,
		cursorPos,
		containerDims,
		clientOffset,
		margins = { ns: 0, ew: 0 }
	} = context

	const { width: menuWidth, height: menuHeight } = dims
	const { width: containerWidth, height: containerHeight } = containerDims

	const clientOffsetLeft = clientOffset?.left ?? 0
	const clientOffsetTop = clientOffset?.top ?? 0

	let left = cursorPos.left - clientOffsetLeft
	let top = cursorPos.top - clientOffsetTop

	const marginOffset = {
		left: margins.ew,
		top: margins.ns,
		bottom: margins.ns,
		right: margins.ew
	}
	const containerEdges = {
		top: marginOffset.top,
		left: marginOffset.left,
		right: containerWidth - marginOffset.right,
		bottom: containerHeight - marginOffset.bottom
	}
	const elemPos = {
		right: menuWidth + left,
		bottom: menuHeight + top,
		top,
		left
	}

	if (elemPos.left < containerEdges.left) {
		left = containerEdges.left
	}
	if (elemPos.top < containerEdges.top) {
		top = containerEdges.top
	}
	if (elemPos.right >= containerEdges.right) {
		const xOffset = elemPos.right - containerEdges.right
		left -= xOffset
	}
	if (elemPos.bottom >= containerEdges.bottom) {
		const yOffset = elemPos.bottom - containerEdges.bottom
		top -= yOffset
	}

	left = Math.max(left, 0)
	top = Math.max(top, 0)

	return { left, top }
}
