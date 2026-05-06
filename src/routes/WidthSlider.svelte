<script lang="ts">
	import { GRID_COLUMN_WIDTHS } from '$lib/lib/utils'

	const STEP_COUNT = GRID_COLUMN_WIDTHS.length
	const MAX_I = Math.max(0, STEP_COUNT - 1)

	let {
		sizeIndex = $bindable(0)
	}: {
		sizeIndex?: number
	} = $props()

	let trackEl = $state<HTMLDivElement | null>(null)
	let dragging = $state(false)

	function clampIndex(n: number) {
		return Math.max(0, Math.min(MAX_I, Math.round(n)))
	}

	const TRACK_PAD = 10
	const DOT = 3

	function syncIndexFromClientX(clientX: number) {
		if (!trackEl) return
		const r = trackEl.getBoundingClientRect()
		/** Distance between first and last dot centers (same as CSS thumb `left` formula). */
		const span = r.width - 2 * TRACK_PAD - DOT
		if (span <= 1) return
		const x = clientX - r.left
		const ratio = (x - TRACK_PAD - DOT / 2) / span
		sizeIndex = clampIndex(ratio * MAX_I)
	}

	function onTrackPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return
		e.preventDefault()
		trackEl?.setPointerCapture(e.pointerId)
		dragging = true
		syncIndexFromClientX(e.clientX)
	}

	function onTrackPointerMove(e: PointerEvent) {
		if (!dragging) return
		syncIndexFromClientX(e.clientX)
	}

	function onTrackPointerUp(e: PointerEvent) {
		if (!dragging) return
		dragging = false
		try {
			trackEl?.releasePointerCapture(e.pointerId)
		} catch {
			/* already released */
		}
	}

</script>

<div class="width-slider" aria-label="Card width">
	<div class="width-slider__icon" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path opacity="0.16" d="M2.94263 4.41394V2.94263H8.82789V8.82789H8.09223C7.27841 8.82789 6.62091 9.48538 6.62091 10.2992C6.62091 11.113 7.27841 11.7705 8.09223 11.7705H12.5062C13.32 11.7705 13.9775 11.113 13.9775 10.2992C13.9775 9.48538 13.32 8.82789 12.5062 8.82789H11.7705V2.94263H17.6558V4.41394C17.6558 5.22776 18.3133 5.88526 19.1271 5.88526C19.9409 5.88526 20.5984 5.22776 20.5984 4.41394V2.20697C20.5984 0.988539 19.6099 0 18.3914 0H10.2992H2.20697C0.988539 0 0 0.988539 0 2.20697V4.41394C0 5.22776 0.657494 5.88526 1.47131 5.88526C2.28514 5.88526 2.94263 5.22776 2.94263 4.41394ZM0.432199 15.1453C-0.142534 15.7201 -0.142534 16.6534 0.432199 17.2282L3.37483 20.1708C3.79783 20.5938 4.42774 20.7179 4.97948 20.4881C5.53122 20.2582 5.88986 19.7248 5.88986 19.1271V17.6558H14.7177V19.1271C14.7177 19.7202 15.0764 20.2582 15.6281 20.4881C16.1799 20.7179 16.8098 20.5892 17.2328 20.1708L20.1754 17.2282C20.7501 16.6534 20.7501 15.7201 20.1754 15.1453L17.2328 12.2027C16.8098 11.7797 16.1799 11.6556 15.6281 11.8855C15.0764 12.1154 14.7177 12.6487 14.7177 13.2464V14.7177H5.88986V13.2464C5.88986 12.6533 5.53122 12.1154 4.97948 11.8855C4.42774 11.6556 3.79783 11.7843 3.37483 12.2027L0.432199 15.1453Z" fill="black"/>
        </svg>            
	</div>
	<div
		bind:this={trackEl}
		class="width-slider__track"
		class:width-slider__track--dragging={dragging}
		style:--thumb-step={sizeIndex}
		style:--thumb-span={MAX_I}
		role="slider"
		aria-valuemin={0}
		aria-valuemax={MAX_I}
		aria-valuenow={sizeIndex}
		aria-orientation="horizontal"
		tabindex="0"
		onpointerdown={onTrackPointerDown}
		onpointermove={onTrackPointerMove}
		onpointerup={onTrackPointerUp}
		onpointercancel={onTrackPointerUp}
		onkeydown={(e) => {
			if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
				e.preventDefault()
				sizeIndex = clampIndex(sizeIndex - 1)
			} else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
				e.preventDefault()
				sizeIndex = clampIndex(sizeIndex + 1)
			} else if (e.key === 'Home') {
				e.preventDefault()
				sizeIndex = 0
			} else if (e.key === 'End') {
				e.preventDefault()
				sizeIndex = MAX_I
			}
		}}
	>
		<div class="width-slider__dots" aria-hidden="true">
			{#each Array(STEP_COUNT) as _, i (i)}
				<span class="width-slider__dot"></span>
			{/each}
		</div>
		<div class="width-slider__thumb"></div>
	</div>
</div>

<style lang="scss">
	.width-slider {
		display: flex;
		align-items: center;
		gap: 14px;
		width: max-content;
		max-width: 100%;
		flex: 0 0 auto;
		user-select: none;
		touch-action: none;
		--height: 18px;
		--track-pad: 10px;
		--dot-size: 3px;
		--width: 110px;
		--thumb-size: 12px;

        &__icon {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 1;
        }
        &__icon svg {
            width: 13px;
        }
        &__track {
            position: relative;
            flex: 1 1 auto;
            width: var(--width);
            height: var(--height);
            padding: 0 var(--track-pad);
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.04);
            cursor: grab;
        }
        &__track:focus {
            outline: none;
        }
        &__track:focus-visible {
            box-shadow:
                rgba(0, 0, 0, 0.06) 0 1px 0 inset,
                0 0 0 2px rgba(94, 187, 255, 0.45);
        }
        &__track--dragging {
            cursor: grabbing;
        }
        &__track--dragging .width-slider__thumb {
            transition: none;
        }
        &__dots {
            position: absolute;
            left: var(--track-pad);
            right: var(--track-pad);
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: space-between;
            pointer-events: none;
        }
        &__dot {
            width: var(--dot-size);
            height: var(--dot-size);
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.14);
        }
        &__thumb {
            position: absolute;
            top: 50%;
            width: var(--thumb-size);
            height: var(--thumb-size);
            left: calc(
                var(--track-pad) + var(--dot-size) / 2 +
                    (100% - 2 * var(--track-pad) - var(--dot-size)) * var(--thumb-step) / max(1, var(--thumb-span))
            );
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: #fff;
            box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.08),
                0 4px 5px rgba(0, 0, 0, 0.05);
            pointer-events: none;
            transition: left 0.14s cubic-bezier(0.2, 0.9, 0.2, 1);
        }
	}

</style>
