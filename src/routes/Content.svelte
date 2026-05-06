<script lang="ts">
	import { browser } from '$app/environment'
	import ContentCard from '$lib/components/ContentCard.svelte'
	import { global } from '$lib/lib/global.svelte'
	import { applyVisibleReorder } from '$lib/libraryContent.svelte'
	import { reorderItemArr } from '$lib/reorderItemArr'
	import type Masonry from 'masonry-layout'

	type MasonryInstance = Masonry & { options: { columnWidth: number; gutter: number } }
	import { onMount, tick } from 'svelte'

	type Props = {
		items: ContentItem[]
		gridView: boolean
		reorderable?: boolean
		/** Masonry column width in px (grid view only). */
		columnWidth?: number
	}

	let { items, gridView, reorderable = true, columnWidth = 140 }: Props = $props()

	const sortedItems = $derived(
		reorderable
			? items.slice().sort((a, b) => a.idx - b.idx)
			: items.slice()
	)
	const GUTTER = 5
	const columnW = $derived(Math.max(120, Math.round(columnWidth)))

	let containerEl = $state<HTMLDivElement | null>(null)
	let msnry: Masonry | null = null
	let resizeObserver: ResizeObserver | null = null
	let itemSrcId = $state<string | null>(null)
	let itemTargetId = $state<string | null>(null)
	/** Sync arm so `dragstart` sees it in the same gesture (before `$state` would flush). */
	let dragArmId: string | null = null

	function destroyMasonry() {
		resizeObserver?.disconnect()
		resizeObserver = null
		if (msnry) {
			msnry.destroy()
			msnry = null
		}
	}

	function layoutAfterImages(el: HTMLElement) {
		const relayout = () => msnry?.layout()
		el.querySelectorAll('img').forEach((img) => {
			if (img.complete) return
			img.addEventListener('load', relayout, { once: true })
		})
		el.querySelectorAll('video').forEach((v) => {
			if (v.readyState >= 1) return
			v.addEventListener('loadeddata', relayout, { once: true })
		})
	}

	async function setupMasonry(el: HTMLDivElement) {
		destroyMasonry()
		const { default: MasonryCtor } = await import('masonry-layout')
		msnry = new MasonryCtor(el, {
			itemSelector: '.lib-masonry__cell',
			columnWidth: columnW,
			gutter: GUTTER,
			percentPosition: false,
			transitionDuration: '0.2s'
		})
		layoutAfterImages(el)
		msnry.layout()

		resizeObserver = new ResizeObserver(() => {
			msnry?.layout()
		})
		resizeObserver.observe(el)
	}

	function onContentDrag(e: DragEvent) {
		e.preventDefault()
		const cell = (e.target as HTMLElement).closest('.lib-masonry__cell') as HTMLElement | null
		itemTargetId = cell?.getAttribute('data-id') ?? null
	}

	function onCellDragStart(e: DragEvent, id: string, cellEl: HTMLElement) {
		itemSrcId = id
		containerEl?.addEventListener('dragover', onContentDrag)
		e.dataTransfer?.setData('text', '')
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
		const card = cellEl.querySelector('.lib-masonry__card') as HTMLElement | null
		if (card && e.dataTransfer) {
			try {
				e.dataTransfer.setDragImage(card, Math.min(80, card.offsetWidth / 2), 24)
			} catch {
				/* setDragImage unsupported in some environments */
			}
		}
	}

	function onHandlePointerDown(id: string) {
		dragArmId = id
	}

	function onHandleDragStart(e: DragEvent, id: string) {
		if (!reorderable) {
			e.preventDefault()
			return
		}
		if (dragArmId !== id) {
			e.preventDefault()
			return
		}
		dragArmId = null
		const cell = (e.currentTarget as HTMLElement).closest('.lib-masonry__cell') as HTMLElement
		onCellDragStart(e, id, cell)
	}

	function onHandlePointerUpArm() {
		dragArmId = null
	}

	function onCellDragEnd() {
		dragArmId = null
		containerEl?.removeEventListener('dragover', onContentDrag)
		const srcId = itemSrcId
		const tgtId = itemTargetId
		itemSrcId = null
		itemTargetId = null
		if (!srcId || !tgtId || srcId === tgtId) return

		const arr = sortedItems
		const srcIdx = arr.findIndex((x) => x.id === srcId)
		const targetIdx = arr.findIndex((x) => x.id === tgtId)
		if (srcIdx === -1 || targetIdx === -1) return

		const { newArray } = reorderItemArr({ array: arr, srcIdx, targetIdx })
		applyVisibleReorder(arr, newArray)
		global.syncItemOrderCache()

		tick().then(() => {
			msnry?.reloadItems()
			msnry?.layout()
		})
	}

	$effect(() => {
		if (!browser) return

		const gv = gridView
		void sortedItems.map((i) => `${i.id}:${i.idx}`).join(',')
		void columnW

		if (!gv) {
			destroyMasonry()
			return
		}

		tick().then(() => {
			const el = containerEl
			if (!el || !gridView) return
			if (!msnry) {
				void setupMasonry(el)
			} else {
				;(msnry as MasonryInstance).options.columnWidth = columnW
				msnry.reloadItems()
				msnry.layout()
				layoutAfterImages(el)
			}
		})
	})

	onMount(() => () => destroyMasonry())
</script>

<div
	bind:this={containerEl}
	class="lib-masonry"
	class:lib-masonry--list={!gridView}
	role="list"
	style:--col-width={`${columnW}px`}
>
	{#each sortedItems as item (item.id)}
		<div
			class="lib-masonry__cell drop-left-border"
			class:drop-left-border--over={itemTargetId === item.id && itemSrcId !== item.id}
			role="listitem"
			data-id={item.id}
		>
		{#if reorderable}
			<div
				class="lib-masonry__handle"
				draggable="true"
				role="separator"
				aria-orientation="horizontal"
				aria-label="Drag to reorder"
				onpointerdown={() => onHandlePointerDown(item.id)}
				onpointerup={onHandlePointerUpArm}
				onpointercancel={onHandlePointerUpArm}
				ondragstart={(e) => onHandleDragStart(e, item.id)}
				ondragend={onCellDragEnd}
			></div>
		{/if}
			<div class="lib-masonry__card">
				<ContentCard {item} />
			</div>
		</div>
	{/each}
</div>

<style lang="scss">
	.lib-masonry {
		position: relative;
		width: 100%;
		// background: red;
		min-height: 700px;

		&--list {
			display: flex;
			flex-direction: column;
			gap: 5px;
		}
		&__cell {
			box-sizing: border-box;
			min-width: 0;
			position: relative;
		}

		&__handle {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 28px;
			z-index: 5;
			background: transparent;
			cursor: grab;
			touch-action: none;

			&:active {
				cursor: grabbing;
			}
		}

		&__card {
			min-width: 0;
		}
		&:not(.lib-masonry--list) &__cell {
			width: var(--col-width);
			margin-bottom: 5px;
		}
	}
</style>
