<script lang="ts" module>
	export type ModalOptions = {
		borderRadius?: string
		zIndex?: string
		overflowX?: string
		overflowY?: string
		height?: string
		closeOnEsc?: boolean
		hingeDown?: boolean
		scaleUp?: boolean
		flat?: boolean
		opacity?: string
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'

	type Props = {
		options?: ModalOptions
		onClickOutSide?: (e: PointerEvent | KeyboardEvent) => void
		fitContent?: boolean
		children: Snippet
	}

	let {
		options = {},
		onClickOutSide,
		fitContent = false,
		children
	}: Props = $props()

	const borderRadius = options.borderRadius ?? '12px'
	const zIndexInner = options.zIndex ?? '1000'
	const overflowX = options.overflowX ?? 'hidden'
	const overflowY = options.overflowY ?? 'scroll'
	const height = options.height ?? 'auto'
	const closeOnEsc = options.closeOnEsc ?? true
	const hingeDown = options.hingeDown ?? false
	const scaleUp = options.scaleUp ?? false
	const flat = options.flat ?? false
	const opacity = options.opacity ?? '0.6'

	let downElem: HTMLElement | null = $state(null)

	function pointerDown(e: PointerEvent) {
		downElem = e.target as HTMLElement
	}

	function pointerUp(e: PointerEvent) {
		const target = e.target as HTMLElement
		const relatedTarget = downElem
		downElem = null

		if (target !== relatedTarget) return
		if (!target.classList.contains('modal-bg') || !onClickOutSide) return

		onClickOutSide(e)
	}

	function onKeyPress(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !closeOnEsc || !onClickOutSide) return
		onClickOutSide(e)
	}
</script>

<svelte:window onkeydown={onKeyPress} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="modal-bg"
	class:modal-bg--flat={flat}
	class:modal-bg--hinge-down={hingeDown}
	class:modal-bg--scale-up={scaleUp}
	onpointerdown={pointerDown}
	onpointerup={pointerUp}
	style:perspective="700px"
	style:background={`rgba(0, 0, 0, ${opacity})`}
>
	<div
		class="modal-bg__content"
		class:modal-bg__content--fit={fitContent}
		style:border-radius={borderRadius}
		style:z-index={zIndexInner}
		style:overflow-x={overflowX}
		style:overflow-y={overflowY}
		style:height={height}
		style:min-height={height}
		style:max-height={height}
	>
		{@render children()}
	</div>
</div>

<style lang="scss">
	.modal-bg {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;

		&__content {
			position: relative;
			width: min(100%, 560px);
			max-width: 100%;
			background: var(--modal-surface-bg, var(--card-bg));
			box-shadow: rgba(var(--textColor1), 0.1) 0 10px 40px;
		}

		&--flat &__content {
			box-shadow: none;
			border: none;
		}

		&__content--fit {
			width: auto;
			min-width: 0;
			max-width: min(92vw, calc(100vw - 48px));
			max-height: min(92vh, calc(100vh - 48px));
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: auto;
		}

		&--hinge-down &__content {
			animation: modal-hinge-down 0.22s cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}

		&--scale-up &__content {
			animation: modal-scale-up 0.22s cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}
	}

	@keyframes modal-scale-up {
		0% {
			opacity: 0;
			transform: scale(0.95);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes modal-hinge-down {
		0% {
			opacity: 0;
			transform: rotateX(-20deg);
		}
		100% {
			opacity: 1;
			transform: rotateX(0);
		}
	}
</style>
