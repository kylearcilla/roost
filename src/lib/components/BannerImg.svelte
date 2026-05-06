<script lang="ts">
	import { abs, cursorPos } from '$lib'

	const BANNER_CTX_ID = 'banner-img-wallpaper-ctx'

	type Props = {
		src: string
		/** 0–100, vertical `object-position` (`center N%`) */
		center?: number
		onCenterChange?: (y: number) => void
		onRemove?: () => void
	}

	let { src, center = 50, onCenterChange, onRemove }: Props = $props()

	let imgEl = $state<HTMLImageElement | null>(null)
	let initDragY = $state(-1)
	let ogCenter = $state(0)
	let previewCenter = $state<number | null>(null)

	const displayCenter = $derived(previewCenter ?? center)

	function dragDown(pe: PointerEvent) {
		if (pe.button !== 0) return
		const t = pe.currentTarget as HTMLElement
		t.setPointerCapture(pe.pointerId)
		initDragY = pe.clientY
		ogCenter = center
		previewCenter = null
	}

	function onDrag(pe: PointerEvent) {
		if (initDragY < 0) return
		const offset = initDragY - pe.clientY
		const nh = imgEl?.naturalHeight || 1
		const percOffset = (offset / nh) * 100 * 2.5
		previewCenter = Math.max(0, Math.min(ogCenter + percOffset, 100))
	}

	function endDrag() {
		if (initDragY < 0) return
		const next = previewCenter
		initDragY = -1
		previewCenter = null
		if (next != null && Math.abs(next - center) > 0.25) onCenterChange?.(next)
	}

	const dragging = $derived(initDragY >= 0)

	function onBannerContextMenu(e: MouseEvent) {
		if (!onRemove) return
		e.preventDefault()
		e.stopPropagation()
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: BANNER_CTX_ID,
			items: [{ type: 'btn', label: 'Remove banner image', id: 'remove' }],
			dims: { width: 160 },
			offset: { top: 0, left: 0 },
			onOptnClick: (_label, id) => {
				abs.close(BANNER_CTX_ID)
				if (id === 'remove') onRemove?.()
			}
		})
	}
</script>

<div class="banner-img" style:cursor={dragging ? 'ns-resize' : 'default'}>
	<div
		class="banner-img__frame"
		role="presentation"
		oncontextmenu={onBannerContextMenu}
		onpointerdown={dragDown}
		onpointermove={onDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<img
			bind:this={imgEl}
			class="banner-img__img"
			{src}
			alt=""
			draggable="false"
			style:object-position={`center ${displayCenter}%`}
		/>
	</div>
</div>

<style lang="scss">
	.banner-img {
		width: 100%;
		overflow: hidden;
		margin-bottom: 0;
	}

	.banner-img__frame {
		position: relative;
		width: 100%;
		height: clamp(120px, 22vw, 180px);
		touch-action: none;
	}

	.banner-img__img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: auto;
		user-select: none;
	}
</style>
