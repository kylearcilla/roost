<script lang="ts">
	import { abs, cursorPos } from '$lib'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import Content from './Content.svelte'
	import LibSearch from './LibSearch.svelte'
	import WidthSlider from './WidthSlider.svelte'
	import { global } from '$lib/lib/global.svelte'
	import { addMediaItem, libraryContent, patchLibraryItem } from '$lib/libraryContent.svelte'
	import { libraryTags } from '$lib/libraryTags.svelte'
	import { mockSidebarNav } from '$lib/mocks'
	import {
		COL_SIZES,
		COLOR_SWATCHES,
		GRID_COLUMN_WIDTHS,
		getMaskedGradientStyle,
		gridColumnSizeAtIndex,
		indexForGridColumnSize,
		snippetPlainText
	} from '$lib/lib/utils'
	import UploadIcon from '$lib/components/UploadIcon.svelte'
	import Header from './Header.svelte'
	import Settings from './Settings.svelte'
	import SideBar from './SideBar.svelte'
	import { tick } from 'svelte'
	import '../scss/app.scss'

	type ToolbarTab = { id: string; label: string; idx: number }

	const TAG_EDIT_FLOAT_ID = 'home-edit-tag-float'

	let gridColumnSizeIndex = $state(indexForGridColumnSize('large'))
	const gridColumnWidthPx = $derived(
		global.onHomePage ? COL_SIZES.large : GRID_COLUMN_WIDTHS[gridColumnSizeIndex]
	)

	$effect.pre(() => {
		if (global.onHomePage) return
		const tab = global.currFilterTab
		void global.selectedCollectionId
		void tab
		void global.collections
		void libraryTags.byId
		let stored: GridColumnSize = 'large'
		if (tab === 'all') {
			stored = global.currCollection?.columnSize ?? 'large'
		} else {
			stored = libraryTags.byId[tab]?.columnSize ?? 'large'
		}
		gridColumnSizeIndex = indexForGridColumnSize(stored)
	})

	$effect(() => {
		if (global.onHomePage || !global.selectedCollectionId) return
		const tab = global.currFilterTab
		const id = tab === 'all' ? global.selectedCollectionId : tab
		void global.setColSize(id, gridColumnSizeAtIndex(gridColumnSizeIndex))
	})

	function onSidebarNav(id: string) {
		if (id === 'home') global.setOnHomePage(true)
		if (id === 'settings') settingsOpen = true
	}

	let settingsOpen = $state(false)
	let gridView = $state(true)
	let linkInput = $state('')
	let prevOnHome = $state(global.onHomePage)
	let prevCollectionId = $state(global.selectedCollectionId)
	let tagDragSrcId = $state<string | null>(null)
	let tagDragTgtId = $state<string | null>(null)

	let tagDescriptionEl = $state<HTMLDivElement | null>(null)
	/** When true, show the description block even if plain text is empty (add-description / focus). */
	let tagDescShellOpen = $state(false)
	let tagDescFieldEmpty = $state(true)

	let tagEditFloatHidden = $state(true)
	let tagEditFloatPos = $state({ top: 0, left: 0 })
	let tagEditDraft = $state('')
	let tagEditInputEl = $state<HTMLInputElement | null>(null)
	let tagEditingTab = $state<ToolbarTab | null>(null)
	let tagEditColor = $state<Color>({ ...COLOR_SWATCHES[0] })
	let ismakingnew = $state(false)

	let currentTab = $derived(global.currFilterTab)
	let currentCid = $derived(global.selectedCollectionId)
	let contentDropZoneEl = $state<HTMLDivElement | null>(null)
	let libToolbarTabsEl = $state<HTMLDivElement | null>(null)
	let contentFileDropOverlay = $state(false)
	let currTags = $derived(global.currTags)
	let isUploadLoading = $state(false)

	const activeTagMeta = $derived.by(() => {
		if (currentTab === 'all') return null
		return currTags.find((t) => t.id === currentTab) ?? null
	})

	const shellCollection = $derived(global.currCollection ?? global.collections[0])

	$effect(() => {
		const h = global.onHomePage
		const cid = global.selectedCollectionId
		const homeChanged = prevOnHome !== h
		const collectionChanged = prevCollectionId !== cid
		if (homeChanged || collectionChanged) linkInput = ''
		prevOnHome = h
		prevCollectionId = cid
	})
	/** Drop invalid tab only when that tag is not in the *current* collection (avoid racing `setCollection` + `applySavedTagFilter`). */
	$effect(() => {
		if (currentTab === 'all') return
		const cid = global.selectedCollectionId
		if (!cid) return
		void libraryTags.byId
		const meta = libraryTags.byId[currentTab]
		const ok = meta && meta.collectionId === cid
		if (!ok) global.currFilterTab = 'all'
	})
	$effect(() => {
		void currentTab
		tagDescShellOpen = false
	})

	function tagDescriptionPlainText(html: string | undefined | null): string {
		if (html == null || typeof html !== 'string') return ''
		const s = html.trim()
		if (!s) return ''
		if (typeof document !== 'undefined') {
			const d = document.createElement('div')
			d.innerHTML = s
			return (d.textContent ?? '').replace(/\s+/g, ' ').trim()
		}
		return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
	}

	$effect(() => {
		const tag = activeTagMeta
		const el = tagDescriptionEl
		if (!tag || !el) return
		if (document.activeElement === el) return
		const desc = tag.description ?? ''
		if (el.innerHTML !== desc) el.innerHTML = desc
		tagDescFieldEmpty = tagDescriptionPlainText(desc) === ''
	})

	async function commitTagDescription(el: HTMLDivElement) {
		if (currentTab === 'all') return
		const id = currentTab
		const cur = libraryTags.byId[id]
		if (!cur || cur.collectionId !== currentCid) return
		const html = el.innerHTML.trim()
		const plain = tagDescriptionPlainText(html)
		const prevHtml = (cur.description ?? '').trim()
		if (!plain) {
			if (cur.description !== undefined) {
				await global.patchTag(id, { description: undefined })
			}
			return
		}
		if (html === prevHtml) return
		await global.patchTag(id, { description: html })
	}

	function onTagDescFocusOut(e: FocusEvent) {
		const el = e.currentTarget as HTMLDivElement
		const rt = e.relatedTarget as Node | null
		if (rt && el.contains(rt)) return
		void commitTagDescription(el).catch((err) => console.error(err))
		tagDescShellOpen = false
	}

	function itemRecencyTs(item: ContentItem): number {
		const raw = item.createdAt?.trim()
		if (!raw) return 0
		const t = Date.parse(raw)
		return Number.isFinite(t) ? t : 0
	}

	function homeSearchHaystack(i: ContentItem): string {
		const tagBits = i.tags
			.map((id) => libraryTags.byId[id]?.name)
			.filter(Boolean)
		return [
			i.title,
			snippetPlainText(i.snippet),
			i.url,
			snippetPlainText(i.quoteText),
			i.author,
			i.source?.name,
			i.source?.shortName,
			...tagBits
		]
			.filter(Boolean)
			.join('\n')
			.toLowerCase()
	}

	const filteredItems = $derived.by(() => {
		if (global.onHomePage) {
			let items = [...libraryContent.items].sort((a, b) => {
				const tb = itemRecencyTs(b)
				const ta = itemRecencyTs(a)
				if (tb !== ta) return tb - ta
				return b.id.localeCompare(a.id)
			})
			const q = linkInput.trim().toLowerCase()
			if (q) items = items.filter((i) => homeSearchHaystack(i).includes(q))
			return items
		}
		const inCol = libraryContent.items.filter((i: ContentItem) =>
			i.collectionIds.includes(currentCid)
		)
		let items = currentTab === 'all' ? inCol : inCol.filter((i: ContentItem) => i.tags.includes(currentTab))
		const raw = linkInput.trim()
		const q = raw.startsWith('#') ? raw.slice(1).trim().toLowerCase() : ''
		if (q) items = items.filter((i) => homeSearchHaystack(i).includes(q))
		return items
	})
	const tabs = $derived(
		currTags.map((t) => ({
			id: t.id,
			label: t.name,
			idx: t.idx ?? 0
		}))
	)

	function applyLibToolbarTabsMask(el: HTMLElement) {
		const { styling } = getMaskedGradientStyle(el, { isVertical: false })
		for (const decl of styling.split(';')) {
			const t = decl.trim()
			if (!t) continue
			const c = t.indexOf(':')
			if (c === -1) continue
			el.style.setProperty(t.slice(0, c).trim(), t.slice(c + 1).trim())
		}
	}

	$effect(() => {
		if (global.onHomePage) return
		void tabs
		void currentCid
		const el = libToolbarTabsEl
		if (!el) return
		const run = () => applyLibToolbarTabsMask(el)
		run()
		void tick().then(run)
		const ro = new ResizeObserver(run)
		ro.observe(el)
		el.addEventListener('scroll', run, { passive: true })
		return () => {
			ro.disconnect()
			el.removeEventListener('scroll', run)
			el.style.removeProperty('mask-image')
			el.style.removeProperty('-webkit-mask-image')
		}
	})
	function tabContextItems(tab: ToolbarTab): DropdownItem[] {
		const meta = libraryTags.byId[tab.id]
		const hasDescription = Boolean(tagDescriptionPlainText(meta?.description))
		const hasTitle = Boolean(meta?.name?.trim())

		return [
			{ type: 'btn', label: 'Edit', id: 'edit' },
			{
				type: 'btn',
				label: hasDescription ? 'Remove Description' : 'Add Description',
				id: hasDescription ? 'remove-description' : 'add-description'
			},
			{ type: 'divider' },
			{ type: 'btn', label: 'Delete', id: 'delete' }
		]
	}

	function closeTagEditFloat() {
		tagEditFloatHidden = true
		tagEditDraft = ''
		tagEditingTab = null
		ismakingnew = false
	}
	function openEditTab(tab: ToolbarTab) {
		ismakingnew = false
		tagEditingTab = tab
		const stored = libraryTags.byId[tab.id]?.name
		tagEditDraft = stored !== undefined && stored !== null ? stored : tab.label
		const col = libraryTags.byId[tab.id]?.color
		tagEditColor = col ? { ...col } : { ...COLOR_SWATCHES[0] }
		tagEditFloatPos = { top: cursorPos.top + 8, left: cursorPos.left }
		tagEditFloatHidden = false
		void tick().then(() => tagEditInputEl?.focus())
	}
	function openNewTagFloat(e: MouseEvent) {
		ismakingnew = true
		tagEditingTab = null
		tagEditColor = {
			...COLOR_SWATCHES[Math.floor(Math.random() * COLOR_SWATCHES.length)]
		}
		tagEditDraft = ''
		tagEditFloatPos = { top: e.clientY + 8, left: e.clientX }
		tagEditFloatHidden = false
		void tick().then(() => tagEditInputEl?.focus())
	}
	function submitTagEditFloat() {
		if (ismakingnew) {
			const next = tagEditDraft.replace(/\s+/g, ' ').trim()
			if (!next || next.toLowerCase() === 'all') {
				closeTagEditFloat()
				return
			}
			const existing = Object.values(libraryTags.byId).find(
				(t) =>
					t.collectionId === currentCid &&
					t.name.trim().toLowerCase() === next.toLowerCase()
			)
			if (existing) {
				global.currFilterTab = existing.id
				void global.persistCollectionFilterPin(existing.id)
				closeTagEditFloat()
				return
			}
			const id = crypto.randomUUID()
			const nextIdx =
				1 +
				Math.max(
					-1,
					...Object.values(libraryTags.byId)
						.filter((t) => t.collectionId === currentCid)
						.map((t) => t.idx ?? -1)
				)
			void global.registerNewTagOrder({
				id,
				name: next,
				color: { ...tagEditColor },
				collectionId: currentCid,
				idx: nextIdx,
				columnSize: global.currCollection?.columnSize ?? 'large'
			})
			closeTagEditFloat()
			return
		}
		const tab = tagEditingTab
		if (!tab) return
		const next = tagEditDraft.replace(/\s+/g, ' ').trim()
		const oldId = tab.id
		const cur = libraryTags.byId[oldId]
		if (!cur || cur.collectionId !== currentCid) {
			closeTagEditFloat()
			return
		}
		const colorChanged =
			tagEditColor.primary !== cur.color.primary ||
			tagEditColor.name !== cur.color.name
		if (!next) {
			closeTagEditFloat()
			return
		}
		if (next === cur.name && !colorChanged) {
			closeTagEditFloat()
			return
		}
		if (next !== cur.name) {
			const dup = Object.values(libraryTags.byId).some(
				(t) =>
					t.id !== oldId &&
					t.collectionId === cur.collectionId &&
					t.name.trim().toLowerCase() === next.trim().toLowerCase()
			)
			if (dup) {
				closeTagEditFloat()
				return
			}
		}
		void global.patchTag(oldId, { name: next, color: { ...tagEditColor } }).catch((err) =>
			console.error(err)
		)
		closeTagEditFloat()
	}
	function onTagEditFloatKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return
		if (!tagEditFloatHidden) {
			e.preventDefault()
			closeTagEditFloat()
		}
	}
	function deleteTab(tab: ToolbarTab) {
		const tagId = tab.id
		const meta = libraryTags.byId[tagId]
		if (!meta) return
		const cid = meta.collectionId
		for (const item of libraryContent.items) {
			if (!item.collectionIds.includes(cid)) continue
			if (!item.tags.includes(tagId)) continue
			patchLibraryItem(item.id, { tags: item.tags.filter((t: string) => t !== tagId) })
		}
		void global.deleteTagAndReindex(tagId)
		if (currentTab === tagId) {
			global.currFilterTab = 'all'
			void global.persistCollectionFilterPin(null)
		}
	}

	function onTagTabDragStart(e: DragEvent, tabId: string) {
		tagDragSrcId = tabId
		tagDragTgtId = null
		e.dataTransfer?.setData('text', '')
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
	}
	function onTagTabsDragOver(e: DragEvent, tabId: string) {
		if (!tagDragSrcId || tagDragSrcId === tabId) return
		e.preventDefault()
		tagDragTgtId = tabId
	}
	function onTagTabDragEnd() {
		const srcId = tagDragSrcId
		const tgtId = tagDragTgtId
		tagDragSrcId = null
		tagDragTgtId = null
		if (!srcId || !tgtId || srcId === tgtId) return
		const srcIdx = libraryTags.byId[srcId]?.idx ?? 0
		const targetIdx = libraryTags.byId[tgtId]?.idx ?? 0
		void global.reorderTagsInCurrentCollection(srcIdx, targetIdx)
	}
	function handleTabContextChoice(tab: ToolbarTab, label: string, itemId?: string) {
		if (itemId === 'edit' || label === 'Edit') openEditTab(tab)
		else if (itemId === 'delete' || label === 'Delete') deleteTab(tab)
		else if (itemId === 'remove-description' || label === 'Remove Description') {
			void global.patchTag(tab.id, { description: undefined }).catch((err) => console.error(err))
		} else if (itemId === 'add-description' || label === 'Add Description') {
			global.currFilterTab = tab.id
			void global.persistCollectionFilterPin(tab.id)
			void global
				.patchTag(tab.id, { description: '' })
				.then(() => {
					tagDescShellOpen = true
					return tick()
				})
				.then(() => tagDescriptionEl?.focus())
				.catch((err) => console.error(err))
		}
	}
	function dataTransferHasOnlyImageOrVideoFiles(dt: DataTransfer | null): boolean {
		if (!dt?.items?.length) return false
		const fileItems = Array.from(dt.items).filter((i) => i.kind === 'file')
		if (!fileItems.length) return false
		for (const it of fileItems) {
			const t = (it.type || '').toLowerCase()
			if (t.startsWith('image/') || t.startsWith('video/')) continue
			if (t === '') continue
			return false
		}
		return true
	}

	/* uploads */

	function droppedFileLooksLikeImageOrVideo(f: File): boolean {
		const t = f.type.toLowerCase()
		if (t.startsWith('image/') || t.startsWith('video/')) return true
		if (t === 'application/octet-stream' || t === '') {
			return /\.(gif|jpe?g|png|webp|avif|svg|bmp|heic|heif|mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(
				f.name
			)
		}
		return false
	}
	function mediaTypeForDroppedFile(f: File): 'image' | 'video' | null {
		const t = f.type.toLowerCase()
		if (t.startsWith('video/')) return 'video'
		if (t.startsWith('image/')) return 'image'
		if (t === 'application/octet-stream' || t === '') {
			if (/\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(f.name)) return 'video'
			if (/\.(gif|jpe?g|png|webp|avif|svg|bmp|heic|heif)$/i.test(f.name)) return 'image'
		}
		return null
	}
	function onContentFileDragEnter(e: DragEvent) {
		if (!dataTransferHasOnlyImageOrVideoFiles(e.dataTransfer)) return
		e.preventDefault()
		contentFileDropOverlay = true
	}
	function onContentFileDragOver(e: DragEvent) {
		if (!dataTransferHasOnlyImageOrVideoFiles(e.dataTransfer)) return
		e.preventDefault()
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
	}
	function onContentFileDragLeave(e: DragEvent) {
		if (!dataTransferHasOnlyImageOrVideoFiles(e.dataTransfer)) return
		const next = e.relatedTarget as Node | null
		if (contentDropZoneEl && next && contentDropZoneEl.contains(next)) return
		contentFileDropOverlay = false
	}
	async function onContentFileDrop(e: DragEvent) {
		if (!dataTransferHasOnlyImageOrVideoFiles(e.dataTransfer)) return
		e.preventDefault()
		contentFileDropOverlay = false
		const list = e.dataTransfer?.files
		if (!list?.length) return
		const cid = currentCid
		const filter = currentTab
		for (const file of Array.from(list)) {
			if (!droppedFileLooksLikeImageOrVideo(file)) continue
			const mediaType = mediaTypeForDroppedFile(file)
			if (!mediaType) continue
			const col = global.collections.find((c) => c.id === cid)
			isUploadLoading = true
			await addMediaItem({
				file,
				mediaStore: { scope: 'collection', collectionId: cid, collectionName: col?.name },
				mediaType,
				collectionId: cid,
				activeTagFilter: filter
			})
			isUploadLoading = false
		}
	}

	function onWindowFileDragEnd() {
		contentFileDropOverlay = false
	}
	function openTabContextMenu(e: MouseEvent, tab: ToolbarTab) {
		e.preventDefault()
		const menuId = `ctx-tab-${tab.id}`
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: menuId,
			items: tabContextItems(tab),
			dims: { width: 140 },
			offset: { top: 0, left: 0 },
			onOptnClick: (label, itemId) => {
				handleTabContextChoice(tab, label, itemId)
				abs.close(menuId)
			}
		})
	}
</script>

<svelte:window onkeydown={onTagEditFloatKeydown} ondragend={onWindowFileDragEnd} />

<svelte:head>
	<title>Roost</title>
</svelte:head>

<div class="home">
	<div class="home__sidebar">
		<SideBar navItems={mockSidebarNav} onNavSelect={onSidebarNav} />
	</div>

	<div class="home__content">
		<Header homeItemCount={global.onHomePage ? filteredItems.length : undefined} />

		<LibSearch bind:linkInput />


		{#if !global.onHomePage}
		<div class="lib-toolbar">
			<div class="lib-toolbar__tabs-container">
				<div bind:this={libToolbarTabsEl} class="lib-toolbar__tabs" role="list">
					<div role="listitem" class="lib-toolbar__tab-all">
						<button
							type="button"
							class="home__content-btn"
							class:home__content-btn--active={currentTab === 'all'}
							onclick={() => {
								global.currFilterTab = 'all'
								void global.persistCollectionFilterPin(null)
							}}
						>
							All
						</button>
					</div>
					{#each tabs as t (t.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="lib-toolbar__tab-container drop-left-border"
							class:drop-left-border--over={tagDragTgtId === t.id &&
								tagDragSrcId &&
								tagDragSrcId !== t.id}
							role="listitem"
							data-id={t.id}
							data-idx={t.idx}
							draggable="true"
							ondragstart={(e) => onTagTabDragStart(e, t.id)}
							ondragover={(e) => onTagTabsDragOver(e, t.id)}
							ondragend={onTagTabDragEnd}
							oncontextmenu={(e) => openTabContextMenu(e, t)}
						>
							<button
								type="button"
								class="home__content-btn"
								class:home__content-btn--active={currentTab === t.id}
								onclick={() => {
									global.currFilterTab = t.id
									void global.persistCollectionFilterPin(t.id)
								}}
							>
								{t.label}
							</button>
						</div>
					{/each}
				</div>
				<button
					type="button"
					class="lib-toolbar__add-btn"
					onclick={(e) => openNewTagFloat(e)}
				>
					<span>
						+
					</span>
				</button>
			</div>
			{#if gridView}
				<div class="lib-toolbar__width">
					<WidthSlider bind:sizeIndex={gridColumnSizeIndex} />
				</div>
			{/if}
		</div>

		<div class="divider"></div>
		{/if}

		{#if
			!global.onHomePage &&
			activeTagMeta &&
			activeTagMeta.description !== undefined &&
			(tagDescriptionPlainText(activeTagMeta.description) !== '' || tagDescShellOpen)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={tagDescriptionEl}
				class="home__tag-desc"
				class:is-empty={tagDescFieldEmpty}
				contenteditable="true"
				role="textbox"
				spellcheck="false"
				aria-multiline="true"
				aria-label="Tag description"
				data-placeholder="Add a tag description…"
				style:margin="0px 0 20px 0"
				onfocusin={() => {
					tagDescShellOpen = true
				}}
				onfocusout={onTagDescFocusOut}
				oninput={(e) => {
					tagDescFieldEmpty = tagDescriptionPlainText(e.currentTarget.innerHTML) === ''
				}}
			></div>
		{/if}

		<div
			class="home__content-drop"
			bind:this={contentDropZoneEl}
			ondragenter={onContentFileDragEnter}
			ondragleave={onContentFileDragLeave}
			ondragover={onContentFileDragOver}
			ondrop={onContentFileDrop}
			role="presentation"
		>
			<div class="home__content-drop__fill">
				<Content
					items={filteredItems}
					{gridView}
					columnWidth={gridColumnWidthPx}
					reorderable={!global.onHomePage}
				/>
			</div>
			{#if contentFileDropOverlay}
				<div class="home__content-drop__overlay" aria-hidden="true">
					<div class="home__content-drop__inner">
						<div class="home__content-drop__icon" aria-hidden="true">
							<UploadIcon context="big" loading={isUploadLoading} />
						</div>
						<p class="home__content-drop__label">Drop Your Files Here</p>
					</div>
				</div>
			{/if}
		</div>

		<FloatInput
			dmenuId={TAG_EDIT_FLOAT_ID}
			bind:hidden={tagEditFloatHidden}
			bind:value={tagEditDraft}
			bind:tagColor={tagEditColor}
			bind:inputRef={tagEditInputEl}
			placeholder="Tag name…"
			inputType="tag"
			onClose={closeTagEditFloat}
			onPress={submitTagEditFloat}
		/>
	</div>
</div>

<Settings open={settingsOpen} onClose={() => (settingsOpen = false)} />

<style lang="scss">
	@use '../scss/mixins.scss' as *;

	.home {
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 100vw;
		display: flex;
		background-color: var(--bg-color);
		overflow: hidden;

		&__content {
			width: calc(100% - 200px);
			// take up entire space
			flex: 1;
			display: flex;
			flex-direction: column;
			padding: var(--main-frame-padding-top) var(--main-frame-padding-sides) 0px var(--main-frame-padding-sides);
		}
		&__content-drop {
			position: relative;
			// take up entire space + allow to shrink
			flex: 1;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
			padding-bottom: 30px;
		}
		&__content-drop__fill {
			/* basis 0 so this row fills the scroll pane; auto basis stays content-height → collapses when empty */
			flex: 1 1 0;
			min-height: 0;
			display: flex;
			flex-direction: column;
		}
		&__content-drop__overlay {
			height: calc(100% - 20px);
			position: absolute;
			inset: 0;
			z-index: 40;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			border: 1px dashed rgba(var(--textColor1), 0.22);
			background: transparent;
			backdrop-filter: blur(5px);
			overflow: hidden;
			isolation: isolate;

			&::before {
				content: '';
				position: absolute;
				inset: 0;
				border-radius: inherit;
				background: color-mix(in srgb, var(--bg-color) 78%, transparent);
				opacity: 0.2;
				animation: drop-zone-anim 2s ease-in-out infinite alternate;
				pointer-events: none;
				z-index: 0;
			}
		}
		&__content-drop__inner {
			position: relative;
			z-index: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 22px;
		}
		&__content-drop__icon {
			width: 72px;
			height: 72px;
			opacity: 0.35;
		}
		&__content-drop__label {
			@include text-style(0.5, 500, 1.15rem);
		}
		&__sidebar {
			width: 200px;
			flex-shrink: 0;
			height: 100%;
			border-right: 1px solid rgba(0, 0, 0, 0.06);
		}
		&__content-btn {
			border: none;
			background: rgba(0, 0, 0, 0.04);
			border-radius: 20px;
			padding: 5px 12px 6px 12px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 2px;
			flex-shrink: 0;
			cursor: pointer;
			font-family: inherit;
			@include text-style(0.585, 400, 1.2rem);
			transition: all 0.2s ease-in-out;
			white-space: nowrap;

			&--active {
				color: #32a0f0;
				background-color: rgba(#5ebbff, 0.07);
				box-shadow:
					rgba(#5ebbff, 0.8) 0px 0px 0px 2px inset,
					rgba(#5ebbff, 0.2) 0px 0px 0px 2.5px;
			}
		}
	}

	@keyframes drop-zone-anim {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 0.9;
		}
	}

	.divider {
		width: 100%;
		border-top: var(--divider-border);
		margin-bottom: 14px;
	}
	.home__tag-desc {
		width: 100%;
		@include text-style(0.48, 400, 1.25rem);
		margin: 0;
		min-height: 1.35em;
		outline: none;
		cursor: text;

		:global(b),
		:global(strong) {
			font-weight: 600;
		}
		:global(i),
		:global(em) {
			font-style: italic;
		}
		:global(u) {
			text-decoration: underline;
		}

		&.is-empty::before {
			content: attr(data-placeholder);
			color: rgba(0, 0, 0, 0.28);
			pointer-events: none;
		}
	}

	.lib-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 5px;

		&__tabs {
			display: flex;
			gap: 3px;
			overflow: auto;
			padding: 4px 5px 4px 4px;
			margin-left: -4px;
			scrollbar-width: none;
			mask-repeat: no-repeat;
			mask-size: 100% 100%;
			-webkit-mask-repeat: no-repeat;
			-webkit-mask-size: 100% 100%;
			&::-webkit-scrollbar {
				display: none;
			}
		}
		&__tabs-container {
			display: flex;
			align-items: center;
			gap: 12px;
			flex: 1 1 auto;
			min-width: 0;
		}
		&__width {
			flex: 0 0 auto;
			display: flex;
			align-items: center;
		}
		&__add-btn {
			position: relative;
			flex-shrink: 0;
			width: 25px;
			height: 25px;
			margin: 0 0px 0 -8px;
			padding: 0;
			border: none;
			border-radius: 20px;
			background: rgba(0, 0, 0, 0);
			cursor: pointer;
			align-self: center;
			transition: background 0.12s ease-in-out, opacity 0.12s ease-in-out;
			opacity: 0.3;

			&:hover {
				background: rgba(0, 0, 0, 0.05);
				opacity: 1;
			}
			span {
				@include text-style(1.2, 300, 1.7rem);
				position: absolute;
				left: 50%;
				top: 50%;
				line-height: 1;
				transform: translate(-50%, calc(-50% - 2px));
				pointer-events: none;
			}
		}
		&__tab-all {
			flex-shrink: 0;
		}
		&__tab-container {
			position: relative;
			border-radius: 20px;
			cursor: grab;
		}
		&__right {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		&__views {
			display: flex;
			align-items: center;
			gap: 4px;
		}
	}
</style>
