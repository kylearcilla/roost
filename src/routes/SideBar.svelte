<script lang="ts">
	import { abs, cursorPos } from '$lib'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import { global } from '$lib/lib/global.svelte'
	import { reorderItemArr as reorderArrayStably } from '$lib/reorderItemArr'
	import { getName } from '$lib/getName'
	import { tick } from 'svelte'

	const COLLECTION_FLOAT_ID = 'sidebar-collection-float'

	const collectionContextItems: DropdownItem[] = [
		{ type: 'btn', label: 'Edit', id: 'edit' },
		{ type: 'btn', label: 'Favorite', id: 'favorite' },
		{ type: 'divider' },
		{ type: 'btn', label: 'Delete', id: 'delete' }
	]

	const favoriteContextItems: DropdownItem[] = [{ type: 'btn', label: 'Remove', id: 'remove' }]

	let {
		navItems,
		onNavSelect
	}: { navItems: SidebarNavItem[]; onNavSelect?: (id: string) => void } = $props()

	
	let collectionsRef: HTMLDivElement | undefined = $state()
	let favoritesRef: HTMLDivElement | undefined = $state()
	let favSrcId = $state<string | null>(null)
	let favTgtId = $state<string | null>(null)
			
	let collectionFloatHidden = $state(true)
	let collectionDraft = $state('')
	let collectionInputEl = $state<HTMLInputElement | null>(null)
	let collectionEditingCol = $state<Collection | null>(null)

	const bySidebarIdx = (a: { id: string; idx?: number }, b: { id: string; idx?: number }) =>
		(a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)

	let collections = $derived([...global.collections].sort(bySidebarIdx))
	let favorites = $derived([...global.favorites].sort(bySidebarIdx))

	let srcId = $state<string | null>(null)
	let targetId = $state<string | null>(null)

	function onFavoriteDragStart(e: DragEvent) {
		const row = (e.target as HTMLElement).closest('.sidebar__favorite-container') as HTMLElement | null
		favSrcId = row?.getAttribute('data-id') ?? null
		if (!favSrcId || !favoritesRef) return
		favoritesRef.addEventListener('dragover', onFavoriteDrag)
		e.dataTransfer?.setData('text', '')
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
	}

	function onFavoriteDrag(e: DragEvent) {
		e.preventDefault()
		const elem = (e.target as HTMLElement).closest('.sidebar__favorite-container') as HTMLElement | null
		if (elem) favTgtId = elem.getAttribute('data-id')
	}

	async function onFavoriteDragEnd() {
		if (favSrcId && favTgtId && favSrcId !== favTgtId) {
			const arr = [...global.favorites].sort(
				(a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)
			)
			const srcIx = arr.findIndex((f) => f.id === favSrcId)
			const targetIx = arr.findIndex((f) => f.id === favTgtId)
			if (srcIx !== -1 && targetIx !== -1) {
				const { newArray } = reorderArrayStably({ array: arr, srcIdx: srcIx, targetIdx: targetIx })
				await global.applyFavoritesOrder(newArray)
			}
		}
		favoritesRef?.removeEventListener('dragover', onFavoriteDrag)
		favSrcId = null
		favTgtId = null
	}

	function onCollectionDragStart(e: DragEvent) {
		const target = e.target as HTMLElement
		const row = target.closest('.sidebar__collection-container') as HTMLElement | null
		srcId = row?.getAttribute('data-id') ?? null

		if (!srcId || !collectionsRef) return

		collectionsRef.addEventListener('dragover', onCollectionDrag)

		e.dataTransfer?.setData('text', '')
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
	}

	function onCollectionDrag(e: DragEvent) {
		e.preventDefault()
		const target = e.target as HTMLElement
		const elem = target.closest('.sidebar__collection-container') as HTMLElement | null
		if (elem) {
			targetId = elem.getAttribute('data-id')
		}
	}

	function collectionInputValue(c: Collection) {
		const em = c.emoji?.trim()
		if (em) return `${em} ${c.name}`.trim()
		return c.name
	}

	function closeCollectionFloat() {
		collectionFloatHidden = true
		collectionDraft = ''
		collectionEditingCol = null
	}

	function addCollection(e: MouseEvent) {
		collectionEditingCol = null
		collectionDraft = ''
		collectionFloatHidden = false
		void tick().then(() => collectionInputEl?.focus())
	}

	function openEditCollection(col: Collection) {
		collectionEditingCol = col
		collectionDraft = collectionInputValue(col)
		collectionFloatHidden = false
		void tick().then(() => collectionInputEl?.focus())
	}

	async function submitCollectionFloat() {
		const v = collectionDraft.trim()
		if (!v) return

		if (collectionEditingCol) {
			const col = collectionEditingCol
			const parsed = getName(v)
			const prevEmoji = col.emoji ?? '📌'
			if (prevEmoji === parsed.emoji && col.name === parsed.name) {
				closeCollectionFloat()
				return
			}
			await global.updateCollection({ ...col, ...parsed })
		} else {
			const parsed = getName(v)
			const id = crypto.randomUUID()
			await global.addCollection({
				id,
				...parsed,
				idx: global.collections.length,
				itemCount: 0,
				columnSize: 'small'
			})
			global.setCollection(id)
		}
		closeCollectionFloat()
	}

	function onCollectionFloatKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return
		if (!collectionFloatHidden) {
			e.preventDefault()
			closeCollectionFloat()
		}
	}

	async function addCollectionToFavorites(col: Collection) {
		await global.addFavoriteFromCollection(col)
	}

	async function handleFavoriteContextChoice(fav: FavoriteFolder, label: string, itemId?: string) {
		if (itemId === 'remove' || label === 'Remove') await global.removeFavoriteAndReindex(fav.id)
	}

	function openFavoriteContextMenu(e: MouseEvent, fav: FavoriteFolder) {
		e.preventDefault()
		const menuId = `ctx-favorite-${fav.id}`
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: menuId,
			items: favoriteContextItems,
			dims: { width: 130 },
			offset: { top: 0, left: 0 },
			onOptnClick: (label, itemId) => {
				handleFavoriteContextChoice(fav, label, itemId)
				abs.close(menuId)
			}
		})
	}

	function selectFavorite(fav: FavoriteFolder) {
		if (fav.collectionId) global.setCollection(fav.collectionId)
	}

	async function handleCollectionContextChoice(col: Collection, label: string, itemId?: string) {
		if (itemId === 'edit' || label === 'Edit') openEditCollection(col)
		else if (itemId === 'favorite' || label === 'Favorite') await addCollectionToFavorites(col)
		else if (itemId === 'delete' || label === 'Delete') await global.deleteCollection(col.id)
	}

	function openCollectionContextMenu(e: MouseEvent, col: Collection) {
		e.preventDefault()
		const menuId = `ctx-collection-${col.id}`
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: menuId,
			items: collectionContextItems,
			dims: { width: 130 },
			offset: { top: 0, left: 0 },
			onOptnClick: (label, itemId) => {
				handleCollectionContextChoice(col, label, itemId)
				abs.close(menuId)
			}
		})
	}

	async function onCollectionDragEnd() {
		if (srcId && targetId && srcId !== targetId) {
			const arr = [...global.collections].sort(
				(a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)
			)
			const srcIx = arr.findIndex((c) => c.id === srcId)
			const targetIx = arr.findIndex((c) => c.id === targetId)
			if (srcIx !== -1 && targetIx !== -1) {
				const { newArray } = reorderArrayStably({ array: arr, srcIdx: srcIx, targetIdx: targetIx })
				await global.applyCollectionsOrder(newArray)
			}
		}
		if (collectionsRef) {
			collectionsRef.removeEventListener('dragover', onCollectionDrag)
		}
		srcId = null
		targetId = null
	}
</script>

<svelte:window onkeydown={onCollectionFloatKeydown} />

<div class="sidebar">
	<div class="sidebar__brand">
		<span class="sidebar__wordmark">roost</span>
	</div>

	<nav class="sidebar__nav">
		{#each navItems as item (item.id)}
			<button
				type="button"
				class="row row--nav"
				class:row--selected={item.id === 'home' && global.onHomePage}
				onclick={() => onNavSelect?.(item.id)}
			>
				<span class="row__main">
					<span class="row__glyph">{item.icon}</span>
					<span class="row__label">{item.label}</span>
				</span>
				{#if item.count != null}
					<span class="row__count">{item.count}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<div class="sidebar__section">
		<div class="sidebar__section-head">
			<span class="sidebar__section-title">Favorites</span>
			<span class="sidebar__section-glyph" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
					<path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>
			</span>
		</div>
		<div class="sidebar__section-body" bind:this={favoritesRef} role="list">
			{#each favorites as fav (fav.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="sidebar__favorite-container drop-top-border"
					role="listitem"
					data-id={fav.id}
					data-idx={fav.idx}
					draggable="true"
					ondragstart={onFavoriteDragStart}
					ondragend={onFavoriteDragEnd}
					class:drop-top-border--over={favTgtId === fav.id && favSrcId !== fav.id}
					oncontextmenu={(e) => openFavoriteContextMenu(e, fav)}
				>
					<button type="button" class="row" onclick={() => selectFavorite(fav)}>
						<span class="row__main">
							<span class="row__glyph">{fav.emoji}</span>
							<span class="row__label">{fav.name}</span>
						</span>
						<span class="row__count">{fav.count}</span>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<div class="sidebar__section">
		<div class="sidebar__section-head">
			<span class="sidebar__section-title">Collections</span>
			<button
				type="button"
				class="sidebar__section-add"
				aria-label="Add collection"
				onclick={addCollection}
			>
				<span class="sidebar__section-add-glyph" aria-hidden="true">+</span>
			</button>
		</div>
		<div class="sidebar__section-body" bind:this={collectionsRef} role="list">
			{#each collections as col (col.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="sidebar__collection-container drop-top-border"
					role="listitem"
					data-id={col.id}
					data-idx={col.idx}
					draggable="true"
					ondragstart={onCollectionDragStart}
					ondragend={onCollectionDragEnd}
					class:drop-top-border--over={targetId === col.id}
					oncontextmenu={(e) => openCollectionContextMenu(e, col)}
				>
					<button
						type="button"
						class="row row--collection"
						class:row--selected={!global.onHomePage && global.selectedCollectionId === col.id}
						onclick={() => global.setCollection(col.id)}
					>
						<span class="row__main">
							{#if col.emoji}
								<span class="row__glyph">{col.emoji}</span>
							{/if}
							<span class="row__label">{col.name}</span>
						</span>
						{#if col.itemCount != null}
							<span class="row__count">{col.itemCount}</span>
						{/if}
					</button>
				</div>
			{/each}
		</div>
	</div>

	<FloatInput
		dmenuId={COLLECTION_FLOAT_ID}
		bind:hidden={collectionFloatHidden}
		bind:value={collectionDraft}
		bind:inputRef={collectionInputEl}
		placeholder={collectionEditingCol ? 'Emoji and name…' : 'Enter collection name…'}
		inputType="text"
		onClose={closeCollectionFloat}
		onPress={submitCollectionFloat}
	/>
</div>

<style lang="scss">
	@use '../scss/mixins.scss' as *;

	.sidebar {
		height: 100vh;
		background: var(--sidebar-bg);
		overflow-y: auto;
		padding: 9px 16px 28px 16px;

		--margin-right: -6px;
		--item-width: calc(100% - 5px);

		&__brand {
			display: flex;
			align-items: center;
			gap: 10px;
			margin-bottom: 5px;
			padding-left: 2px;
		}
		&__mark {
			font-size: 1.45rem;
			line-height: 1;
			flex-shrink: 0;
			filter: saturate(1.1);
		}
		&__wordmark {
			@include text-style(0.82, 400, 1.5rem, 'Geist Mono');
			text-transform: lowercase;
			margin-bottom: 5px;
		}
		&__nav {
			display: flex;
			flex-direction: column;
			gap: 0px;
			margin-bottom: 6px;
		}
		&__section {
			margin-top: 16px;
		}
		&__section-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 8px;
			padding: 0 0 0 2px;
			width: calc(100% - 0px);
		}
		&__section-title {
			@include text-style(0.45, 500, 1.12rem);
		}
		&__section-glyph {
			line-height: 1;

			svg {
				color: rgba(var(--textColor1), 0.1);
				width: 12px;
				height: 12px;
			}
		}
		&__section-add {
			position: relative;
			flex-shrink: 0;
			width: 20px;
			height: 20px;
			margin: 0 -5px 0 0;
			padding: 0;
			border: none;
			border-radius: 4px;
			background: rgba(0, 0, 0, 0);
			cursor: pointer;
			align-self: center;
			transition: background 0.12s ease-in-out, opacity 0.12s ease-in-out;
			opacity: 0.3;

			&:hover {
				background: rgba(0, 0, 0, 0.05);
				opacity: 1;
			}
		}

		&__section-add-glyph {
			@include text-style(1.2, 300, 1.7rem);
			position: absolute;
			left: 50%;
			top: 50%;
			line-height: 1;
			transform: translate(-50%, calc(-50% - 2px));
			pointer-events: none;
		}
		&__section-body {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		&__favorite-container,
		&__collection-container {
			position: relative;
			border-radius: 10px;

			&[draggable='true'] {
				cursor: grab;
			}
			&:active {
				cursor: grabbing;
			}
		}
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: var(--item-width);
		padding: 6px 10px;
		margin: 0 -6px 1px var(--margin-right);
		border: none;
		border-radius: 10px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		font-family: inherit;

		&__main {
			display: flex;
			align-items: center;
			gap: 10px;
			min-width: 0;
		}
		&__glyph {
			font-size: 1.2rem;
			line-height: 1;
			filter: grayscale(1);
			opacity: 0.5;
		}
		&__label {
			@include text-style(0.88, 400, 1.225rem);
			min-width: 0;
		}
		&__count {
			@include text-style(0.38, 400, 1.15rem);
			flex-shrink: 0;
		}

		&:hover,
		&:focus-visible {
			background: rgba(0, 0, 0, 0.035);
		}

		&:hover &__glyph,
		&:focus-visible &__glyph,
		&.row--selected .row__glyph {
			filter: grayscale(0);
			opacity: 1;
		}

		&.row--selected {
			background: rgba(0, 0, 0, 0.04) !important;
		}
	}

</style>
