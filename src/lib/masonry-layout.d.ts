declare module 'masonry-layout' {
	interface MasonryOptions {
		itemSelector?: string
		columnWidth?: number | string
		gutter?: number
		percentPosition?: boolean
		transitionDuration?: string | false
		[key: string]: unknown
	}

	export default class Masonry {
		constructor(element: Element | string, options?: MasonryOptions)
		element: HTMLElement
		reloadItems(): void
		layout(): void
		destroy(): void
	}
}
