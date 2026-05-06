type OutHandler = (e: CustomEvent<{ target: HTMLElement; src: HTMLElement }>) => void

/**
 * Calls `handler` when a click happens outside `node`, respecting nested `[data-dmenu-id]`.
 */
export function clickOutside(node: HTMLElement, handler?: OutHandler) {
	const handleDocClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement
		const hasClickedInsideNode = node?.contains(target)

		const srcDmenuId = node.getAttribute('data-dmenu-id')
		const targetElem = target.closest('[data-dmenu-id]')

		let sameDropdownContext = false

		if (srcDmenuId && targetElem) {
			const targetId = targetElem.getAttribute('data-dmenu-id')
			sameDropdownContext = srcDmenuId === targetId
		}

		const hasClickedOutside =
			!sameDropdownContext && !hasClickedInsideNode && !event.defaultPrevented

		if (hasClickedOutside) {
			handler?.(
				new CustomEvent('outClick', {
					bubbles: true,
					detail: { target, src: node }
				})
			)
		}
	}

	document.addEventListener('click', handleDocClick, true)

	return {
		destroy() {
			document.removeEventListener('click', handleDocClick, true)
		}
	}
}
