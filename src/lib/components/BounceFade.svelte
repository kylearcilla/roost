<script module lang="ts">
	export type BounceFadeInset = {
		top?: number
		left?: number
		bottom?: number
		right?: number
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import { clickOutside } from '$lib/actions/click-outside'

	function pxOrUndef(v: number | undefined): string | undefined {
		if (v == null || Number.isNaN(v)) return undefined
		return `${v}px`
	}

	let {
		id,
		dmenuId,
		isHidden,
		position,
		isAnim = true,
		zIndex = 1,
		onClickOutside = undefined,
		posType = 'fixed',
		onDismount = undefined,
		children
	}: {
		id?: string
		dmenuId: string
		isHidden: boolean
		position: BounceFadeInset
		isAnim?: boolean
		zIndex?: number
		posType?: 'fixed' | 'absolute'
		onClickOutside?: ((e: CustomEvent) => void) | undefined
		onDismount?: (() => void) | undefined
		children: Snippet
	} = $props()

	const TRANSITION_DURATIONS_MS = 150

	let isMounted = $state(false)
	let doShow = $state(false)
	let removeTimeout = $state<ReturnType<typeof setTimeout> | null>(null)
	let pos = $state<BounceFadeInset>({})

	$effect(() => {
		toggleElem(!isHidden)
	})

	function toggleElem(isActive: boolean) {
		if (isActive) {
			isMounted = true
			pos = { ...position }
			requestAnimationFrame(() => {
				doShow = true
			})
		}
		if (isActive && removeTimeout) {
			clearTimeout(removeTimeout)
			removeTimeout = null
		}
		if (!isActive) {
			doShow = false

			removeTimeout = setTimeout(() => {
				isMounted = false
				removeTimeout = null
				onDismount?.()
			}, TRANSITION_DURATIONS_MS)
		}
	}
</script>

{#if isMounted}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		{id}
		data-dmenu-id={dmenuId}
		class="bounce-fade"
		class:bounce-fade--shown={doShow}
		class:bounce-fade--animated={isAnim}
		style:position={posType}
		style:z-index={zIndex}
		style:top={pxOrUndef(pos.top)}
		style:left={pxOrUndef(pos.left)}
		style:bottom={pxOrUndef(pos.bottom)}
		style:right={pxOrUndef(pos.right)}
		style:--duration={`${TRANSITION_DURATIONS_MS}ms`}
		oncontextmenu={(e) => {
			e.preventDefault()
		}}
		use:clickOutside={onClickOutside}
	>
		{@render children()}
	</div>
{/if}

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.bounce-fade {
		transform: scale(0.94);
		@include not-visible;

		transition:
			var(--duration) opacity cubic-bezier(0.2, 0.45, 0, 1),
			var(--duration) visibility cubic-bezier(0.2, 0.45, 0, 1),
			var(--duration) transform cubic-bezier(0.2, 0.45, 0, 1);

		&--shown {
			transform: scale(1);
			@include visible;
		}
	}
</style>
