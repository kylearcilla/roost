<script lang="ts">
	import { abs, cursorPos } from '$lib'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import Modal from '$lib/components/Modal.svelte'
	import SourceLink from '$lib/components/SourceLink.svelte'
	import { hashTagLabel } from '$lib/lib/tagLabels'
	import { COLOR_SWATCHES, formatCardDate } from '$lib/lib/utils'
	import { extractUrl } from '$lib/lib/collection-sources'
	import { DEFAULT_IMG_UPLOAD_CONSTRAINTS, validateImgURL } from '$lib/lib/fetch-content'
	import { global } from '$lib/lib/global.svelte'
	import {
		mediaDisplaySrc,
		persistVolatileImageHref,
		saveImportedUserFile,
		type ImportedMediaStoreScope
	} from '$lib/lib/importedMedia'
	import { patchLibraryItem } from '$lib/libraryContent.svelte'
	import { libraryTags, patchLibraryTag } from '$lib/libraryTags.svelte'
	import { openTagAssignPicker } from '$lib/mocks/tags'
	import { tick } from 'svelte'
	
	let { item }: { item: ContentItem } = $props()

	const cardMediaStore = $derived.by((): ImportedMediaStoreScope => {
		const cid = item.collectionIds[0]?.trim() ?? ''
		if (!cid) return { scope: 'user' }
		const col = global.collections.find((c) => c.id === cid)
		return { scope: 'collection', collectionId: cid, collectionName: col?.name }
	})

	const ctxMenuId = $derived(`ctx-card-${item.id}`)
	const videoThumbResumeTimeByKey = new Map<string, number>()

	const CARD_MENU_WIDTH = 150
	const CARD_MENU_HEIGHT = 340

	const imageFormatMenuId = $derived(`ctx-card-imgfmt-${item.id}`)
	const imgFloatDmenuId = $derived(`content-card-img-float-${item.id}`)
	const tagCtxMenuId = $derived(`ctx-card-tag-${item.id}`)
	const tagAssignMenuId = $derived(`tag-assign-${item.id}`)
	const tagReplaceMenuId = $derived(`tag-replace-${item.id}`)
	const tagEditFloatDmenuId = $derived(`content-card-tag-float-${item.id}`)

	const DIM_ORDER: ImageDimsType[] = ['auto', 'default', '3x2', 'portrait', 'square', 'video']
	const VIDEO_HOVER_PLAY_MS = 200
	const videoHoverPlayTimers = new WeakMap<HTMLVideoElement, number>()
	const videoHoverPlayCommitted = new WeakMap<HTMLVideoElement, boolean>()

	const DIM_MENU_LABEL: Record<ImageDimsType, string> = {
		auto: 'Auto',
		default: 'Default',
		'3x2': '3×2',
		portrait: 'Portrait',
		square: 'Square',
		video: 'Video'
	}
	const DIM_ASPECT_RATIO: Record<ImageDimsType, string> = {
		auto: 'auto',
		default: '1 / 1.07',
		'3x2': '3 / 2',
		portrait: '9 / 16',
		square: '1 / 1',
		video: '16 / 9'
	}

	let imgFloatHidden = $state(true)
	let imgLinkDraft = $state('')
	let imgFloatMode = $state<'add' | 'replace'>('add')
	let imgFileInputEl: HTMLInputElement | null = null
	let imgSubmitJitter = $state(false)
	let imgSubmitShowArrow = $state(false)
	let imgSubmitValidating = $state(false)
	let titleSlotOpen = $state(false)
	let descriptionSlotOpen = $state(false)

	let tagContextTagId = $state<string | null>(null)
	/** Tag hashtag shown with `.underlined` while its menu / replace picker / edit float is active. */
	let tagUnderlineTagId = $state<string | null>(null)
	let suppressTagUnderlineClearOnce = $state(false)
	let tagMenuPointer = $state({ top: 0, left: 0 })
	let tagEditFloatHidden = $state(true)
	let tagEditFloatPos = $state({ top: 0, left: 0 })
	let tagEditDraft = $state('')
	let tagEditColor = $state<Color>({ ...COLOR_SWATCHES[0] })
	let tagEditInputEl = $state<HTMLInputElement | null>(null)
	let tagEditTargetId = $state<string | null>(null)


	const dateLine = $derived(formatCardDate(item.createdAt ?? ''))

	function tagLabel(id: string): string {
		return global.currTags.find((t) => t.id === id)?.name ?? libraryTags.byId[id]?.name ?? id
	}

	const assignableTagIds = $derived.by(() => {
		const chosen = new Set(item.tags)
		return global.currTags.filter((t) => !chosen.has(t.id)).map((t) => t.id)
	})

	/** Assignable tags if `excludeTagId` were removed (for replace picker). */
	function candidateTagIdsReplacing(excludeTagId: string): string[] {
		const chosen = new Set(item.tags.filter((t) => t !== excludeTagId))
		return global.currTags.filter((t) => !chosen.has(t.id)).map((t) => t.id)
	}

	type CardTagChip = { id: string; name: string }

	const cardTagChips = $derived.by((): CardTagChip[] => {
		const out: CardTagChip[] = []
		for (const id of item.tags) {
			out.push({ id, name: tagLabel(id) })
		}
		return out
	})

	let titleEl = $state<HTMLElement | null>(null)
	let snippetEl = $state<HTMLElement | null>(null)


	const hasDescription = $derived(
		Boolean((item.snippet ?? '').trim() || (item.quoteText ?? '').trim())
	)
	const hasTitle = $derived(Boolean((item.title ?? '').trim()))
	const hasImage = $derived(
		Boolean(item.media && (item.media.url?.trim() || item.media.path?.trim()))
	)
	const subDisplay = $derived(
		item.kind === 'quote' ? (item.quoteText ?? item.snippet ?? '') : (item.snippet ?? '')
	)
	const showTitleBlock = $derived(hasTitle || titleSlotOpen)
	const showDescriptionBlock = $derived(hasDescription || descriptionSlotOpen)

	const sourceLine = $derived(
		`${item.source?.icon ?? ''} ${item.source?.name ?? ''}`.replace(/\s+/g, ' ').trim()
	)
	const hasMediaSrc = $derived(
		Boolean(item.media && ((item.media.url ?? '').trim() || (item.media.path ?? '').trim()))
	)
	const cardImgAspectRatio = $derived.by(() => {
		if (!hasMediaSrc) return DIM_ASPECT_RATIO.default
		const d = item.media?.dims
		if (!d || d === 'auto') return DIM_ASPECT_RATIO.auto
		return DIM_ASPECT_RATIO[d]
	})
	const useIntrinsicMediaRatio = $derived(
		Boolean(hasMediaSrc && (!item.media?.dims || item.media.dims === 'auto'))
	)
	const mediaImageUrl = $derived(
		item.media?.type === 'image' ? mediaDisplaySrc(item.media) : ''
	)
	const mediaVideoUrl = $derived(
		item.media?.type === 'video' ? mediaDisplaySrc(item.media) : ''
	)
	const mediaModalSrc = $derived.by(() => {
		const m = item.media
		if (!m || (!(m.url ?? '').trim() && !(m.path ?? '').trim())) return ''
		return mediaDisplaySrc(m)
	})

	const mediaModalIsVideo = $derived(item.media?.type === 'video')

	let mediaModalOpen = $state(false)
	let mediaModalVideoEl = $state<HTMLVideoElement | null>(null)


	$effect(() => {
		if (!mediaModalOpen || !mediaModalIsVideo || !mediaModalVideoEl) return
		const v = mediaModalVideoEl
		void tick().then(() => {
			if (!mediaModalOpen || mediaModalVideoEl !== v) return
			void v.play().catch(() => {
				v.muted = true
				void v.play().catch(() => {})
			})
		})
	})
	$effect(() => {
		const title = item.title ?? ''
		const sub = subDisplay
		item.id
		item.kind
		if (titleEl && document.activeElement !== titleEl) titleEl.textContent = title
		if (snippetEl && document.activeElement !== snippetEl) snippetEl.textContent = sub
	})
	$effect(() => {
		if (imgFloatHidden) return
		if (imgLinkDraft.trim() !== '') return
		imgSubmitShowArrow = false
	})

	function closeMediaModal() {
		mediaModalVideoEl?.pause()
		mediaModalOpen = false
	}
	function onMediaDblClick(e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		if (!mediaModalSrc) return
		mediaModalOpen = true
	}

	/* images */

	function closeImgFloat() {
		imgFloatHidden = true
		imgFloatMode = 'add'
		imgLinkDraft = ''
		imgSubmitShowArrow = false
	}
	function openImgFilePicker() {
		imgFileInputEl?.click()
	}
	async function onImgFilePicked(e: Event) {
		const el = e.currentTarget as HTMLInputElement
		const file = el.files?.[0]
		el.value = ''
		if (!file || !file.type.startsWith('image/')) return
		const saved = await saveImportedUserFile(file, cardMediaStore)
		if (saved.ok) {
			if (imgFloatMode === 'add') {
				patchLibraryItem(item.id, {
					media: {
						id: crypto.randomUUID(),
						type: 'image',
						url: undefined,
						path: saved.absolutePath,
						dims: 'auto'
					}
				})
			} else {
				const m = item.media
				const typ = m?.type === 'video' ? 'video' : 'image'
				const dims = m?.dims ?? 'auto'
				patchLibraryItem(item.id, {
					media: {
						id: mediaIdForPatch(m),
						type: typ,
						url: undefined,
						path: saved.absolutePath,
						dims
					}
				})
			}
		} else {
			await applyImageHref(URL.createObjectURL(file))
		}
		closeImgFloat()
	}
	function triggerImgSubmitJitter() {
		imgSubmitJitter = true
		window.setTimeout(() => imgSubmitJitter = false, 320)
	}
	function onVideoThumbPointerLeave(e: PointerEvent & { currentTarget: HTMLVideoElement }) {
		const v = e.currentTarget
		clearVideoHoverPlayTimer(v)
		if (videoHoverPlayCommitted.get(v)) {
			videoThumbResumeTimeByKey.set(videoThumbResumeKey(), v.currentTime)
			videoHoverPlayCommitted.delete(v)
		}
		v.pause()
		v.muted = true
	}
	function mediaIdForPatch(m?: Media | null) {
		return m?.id ?? crypto.randomUUID()
	}

	async function applyImageHref(href: string) {
		let url: string | undefined = href
		let mediaPath: string | undefined
		if (href.startsWith('blob:') || href.startsWith('data:')) {
			const r = await persistVolatileImageHref(href, cardMediaStore)
			if ('path' in r) {
				url = undefined
				mediaPath = r.path
			} else {
				url = r.url
			}
		}
		if (imgFloatMode === 'add') {
			patchLibraryItem(item.id, {
				media: {
					id: crypto.randomUUID(),
					type: 'image',
					url,
					path: mediaPath,
					dims: 'auto'
				}
			})
		} else {
			const m = item.media
			const typ = m?.type === 'video' ? 'video' : 'image'
			const dims = m?.dims ?? 'auto'
			patchLibraryItem(item.id, {
				media: {
					id: mediaIdForPatch(m),
					type: typ,
					url,
					path: mediaPath,
					dims
				}
			})
		}
	}

	/* uploads */

	async function submitImgFloat() {
		const raw = imgLinkDraft.trim()
		if (!raw) return
		const extracted = extractUrl(imgLinkDraft)
		if (!extracted) {
			if (raw) triggerImgSubmitJitter()
			imgSubmitShowArrow = false
			return
		}
		if (!imgSubmitShowArrow) {
			imgSubmitShowArrow = true
			return
		}
		const again = extractUrl(imgLinkDraft)
		if (!again) {
			triggerImgSubmitJitter()
			imgSubmitShowArrow = false
			return
		}
		const href = again.href
		if (href.startsWith('blob:') || href.startsWith('data:')) {
			await applyImageHref(href)
			closeImgFloat()
			return
		}
		imgSubmitValidating = true
		try {
			await validateImgURL({ url: href, constraints: DEFAULT_IMG_UPLOAD_CONSTRAINTS })
			await applyImageHref(href)
			closeImgFloat()
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return
			triggerImgSubmitJitter()
			imgSubmitShowArrow = false
		} finally {
			imgSubmitValidating = false
		}
	}
	function openImgFloat(mode: 'add' | 'replace') {
		imgFloatMode = mode
		imgLinkDraft = ''
		imgSubmitShowArrow = false
		imgFloatHidden = false
	}
	function onCardWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return
		if (!tagEditFloatHidden) {
			e.preventDefault()
			closeTagEditFloat()
			return
		}
		if (!imgFloatHidden) {
			e.preventDefault()
			closeImgFloat()
		}
	}

	function getTagContextItems(tagId: string): DropdownItem[] {
		const known = Boolean(libraryTags.byId[tagId])
		const items: DropdownItem[] = []
		if (known) items.push({ type: 'btn', label: 'Edit', id: 'edit' })
		items.push({ type: 'btn', label: 'Replace…', id: 'replace-tag' })
		items.push({ type: 'btn', label: 'Remove', id: 'remove' })
		return items
	}

	function openTagContextMenu(e: MouseEvent, tagId: string) {
		e.preventDefault()
		e.stopPropagation()
		tagContextTagId = tagId
		tagUnderlineTagId = tagId
		tagMenuPointer = { top: e.clientY, left: e.clientX }
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: tagCtxMenuId,
			items: getTagContextItems(tagId),
			dims: { width: 140 },
			offset: { top: 0, left: 0 },
			onOptnClick: handleTagContextChoice,
			onClose: () => {
				if (suppressTagUnderlineClearOnce) {
					suppressTagUnderlineClearOnce = false
					return
				}
				tagUnderlineTagId = null
			}
		})
	}

	function handleTagContextChoice(_label: string, id?: string) {
		const tid = tagContextTagId
		tagContextTagId = null
		if (!tid) {
			abs.close(tagCtxMenuId)
			return
		}
		if (id === 'replace-tag') {
			suppressTagUnderlineClearOnce = true
			abs.close(tagCtxMenuId)
			openTagAssignPicker({
				menuId: tagReplaceMenuId,
				candidateTagIds: candidateTagIdsReplacing(tid),
				tagName: tagLabel,
				onPick: (newId) => {
					if (newId === tid) return
					patchLibraryItem(item.id, {
						tags: item.tags.map((t) => (t === tid ? newId : t))
					})
				},
				onDismiss: () => {
					tagUnderlineTagId = null
				}
			})
			return
		}
		if (id === 'edit') {
			suppressTagUnderlineClearOnce = true
			abs.close(tagCtxMenuId)
			openTagEditFloatFor(tid)
			return
		}
		abs.close(tagCtxMenuId)
		if (id === 'remove') {
			patchLibraryItem(item.id, { tags: item.tags.filter((t) => t !== tid) })
		}
	}

	function closeTagEditFloat() {
		tagEditFloatHidden = true
		tagEditDraft = ''
		tagEditTargetId = null
		tagUnderlineTagId = null
	}

	function openTagEditFloatFor(tagId: string) {
		const cur = libraryTags.byId[tagId]
		if (!cur) {
			tagUnderlineTagId = null
			return
		}
		tagUnderlineTagId = tagId
		tagEditTargetId = tagId
		tagEditDraft = cur.name
		tagEditColor = { ...cur.color }
		tagEditFloatPos = { top: tagMenuPointer.top + 8, left: tagMenuPointer.left }
		tagEditFloatHidden = false
		void tick().then(() => tagEditInputEl?.focus())
	}

	function submitTagEditFromCard() {
		const oldId = tagEditTargetId
		if (!oldId) return
		const cur = libraryTags.byId[oldId]
		if (!cur) {
			closeTagEditFloat()
			return
		}
		const next = tagEditDraft.replace(/\s+/g, ' ').trim()
		if (!next) {
			closeTagEditFloat()
			return
		}
		const colorChanged =
			tagEditColor.primary !== cur.color.primary || tagEditColor.name !== cur.color.name
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
		patchLibraryTag(oldId, { name: next, color: { ...tagEditColor } })
		global.syncTagsFromLibrary()
		closeTagEditFloat()
	}

	/* video */

	function videoThumbResumeKey(): string {
		const u = mediaDisplaySrc(item.media ?? {}).trim()
		return `${item.id}\0${u}`
	}
	function clearVideoHoverPlayTimer(v: HTMLVideoElement) {
		const t = videoHoverPlayTimers.get(v)
		if (t !== undefined) {
			clearTimeout(t)
			videoHoverPlayTimers.delete(v)
		}
	}
	function onVideoThumbPointerEnter(e: PointerEvent & { currentTarget: HTMLVideoElement }) {
		const v = e.currentTarget
		clearVideoHoverPlayTimer(v)
		const id = window.setTimeout(() => {
			videoHoverPlayTimers.delete(v)
			if (!v.isConnected) return
			const key = videoThumbResumeKey()
			let resume = videoThumbResumeTimeByKey.get(key) ?? 0
			if (Number.isFinite(v.duration) && v.duration > 0) {
				resume = Math.min(Math.max(0, resume), v.duration - 0.001)
			} else {
				resume = Math.max(0, resume)
			}
			v.currentTime = resume
			v.loop = true
			v.muted = false
			videoHoverPlayCommitted.set(v, true)
			void v.play().catch(() => {})
		}, VIDEO_HOVER_PLAY_MS)
		videoHoverPlayTimers.set(v, id)
	}

	/* media */

	function ctxRemoveImage() {
		patchLibraryItem(item.id, { media: undefined, isBare: undefined })
	}
	function ctxSetImageDims(dims: ImageDimsType) {
		const m = item.media
		if (!m || !(m.url?.trim() || m.path?.trim())) return
		patchLibraryItem(item.id, {
			media: {
				id: mediaIdForPatch(m),
				type: m.type === 'video' ? 'video' : 'image',
				url: m.url,
				path: m.path,
				dims
			}
		})
	}
	function parseDimsMenuId(id: string): ImageDimsType | null {
		const s = id.startsWith('img-dims-') ? id.slice('img-dims-'.length) : ''
		if (
			s === 'auto' ||
			s === '3x2' ||
			s === 'portrait' ||
			s === 'square' ||
			s === 'video' ||
			s === 'default'
		) {
			return s
		}
		return null
	}
	function getImageFormatItems(): DropdownItem[] {
		const items: DropdownItem[] = []
		for (const d of DIM_ORDER) {
			items.push({
				type: 'btn',
				label: DIM_MENU_LABEL[d],
				id: `img-dims-${d}`
			})
		}
		return items
	}
	function openImageFormatSubmenu() {
		const dims = item.media?.dims
		abs({
			id: imageFormatMenuId,
			items: getImageFormatItems(),
			chosenText: dims ? DIM_MENU_LABEL[dims] : undefined,
			dims: { width: 130 },
			onOptnClick: handleImageFormatChoice
		})
	}
	function handleImageFormatChoice(_label: string, id?: string) {
		const dim = id ? parseDimsMenuId(id) : null
		if (dim) ctxSetImageDims(dim)
		abs.close(imageFormatMenuId)
	}

	/* options */

	function getContextItems(): DropdownItem[] {
		const hasLink = Boolean(item.source?.url?.trim())
		const items: DropdownItem[] = []
		const tags: CardTagChip[] = assignableTagIds.map((id) => ({
			id,
			name: tagLabel(id)
		}))
		if (tags.length > 0) {
			items.push({ type: 'btn', label: 'Assign Tag', id: 'assign-tag' })
		}
		if (!hasLink) {
			items.push({ type: 'btn', label: 'Add Source' })
		}
		if (hasDescription) {
			items.push({ type: 'btn', label: 'Remove Description' })
		} 
		else {
			items.push({ type: 'btn', label: 'Add Description' })
		}
		if (hasTitle) {
			items.push({ type: 'btn', label: 'Remove Title' })
		}
		else {
			items.push({ type: 'btn', label: 'Add Title' })
		}
		if (hasImage) {
			items.push({
				type: 'toggle',
				label: 'Bare Image',
				active: item.isBare !== false,
				onToggle: () =>
					patchLibraryItem(item.id, {
						isBare: item.isBare === false ? undefined : false
					})
			})
		}

		items.push({ type: 'divider' })
		if (!hasImage) {
			items.push({ type: 'btn', label: 'Add Image', id: 'img-add' })
		} 
		else {
			items.push(
				{ type: 'section', name: 'Image' },
				{ type: 'btn', label: 'Set format', id: 'img-format-open' },
				{ type: 'btn', label: 'Change', id: 'img-replace' },
				{ type: 'btn', label: 'Remove', id: 'img-remove' }
			)
		}

		items.push({ type: 'divider' }, { type: 'btn', label: 'Delete' })
		return items
	}

	function handleContextMenuChoice(label: string, id?: string) {
		if (id === 'assign-tag') {
			abs.close(ctxMenuId)
			openTagAssignPicker({
				menuId: tagAssignMenuId,
				candidateTagIds: assignableTagIds,
				tagName: tagLabel,
				onPick: (tagId) => {
					if (item.tags.includes(tagId)) return
					patchLibraryItem(item.id, { tags: [...item.tags, tagId] })
				}
			})
			return
		}
		if (id === 'img-format-open') {
			abs.close(ctxMenuId)
			openImageFormatSubmenu()
			return
		}
		if (id === 'img-add' || id === 'img-replace') {
			abs.close(ctxMenuId)
			openImgFloat(id === 'img-add' ? 'add' : 'replace')
			return
		}
		if (id === 'img-remove') ctxRemoveImage()
		else if (label === 'Update Type') ctxUpdateType()
		else if (label === 'Add Title') ctxAddTitle()
		else if (label === 'Remove Title') ctxRemoveTitle()
		else if (label === 'Add Description') ctxAddDescription()
		else if (label === 'Remove Description') ctxRemoveDescription()
		else if (label === 'Add Source') ctxAddSource()
		else if (label === 'Delete') ctxDelete()
		abs.close(ctxMenuId)
	}

	function openCardContextMenu(e: MouseEvent) {
		e.preventDefault()
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: ctxMenuId,
			items: getContextItems(),
			dims: { width: CARD_MENU_WIDTH, height: CARD_MENU_HEIGHT },
			offset: { top: 0, left: 0 },
			onOptnClick: handleContextMenuChoice
		})
	}

	/* edits */

	function ctxUpdateType() {}

	function ctxAddTitle() {
		titleSlotOpen = true
		void tick().then(() => titleEl?.focus())
	}

	function ctxRemoveTitle() {
		titleSlotOpen = false
		patchLibraryItem(item.id, { title: undefined })
	}

	function ctxAddDescription() {
		descriptionSlotOpen = true
		void tick().then(() => snippetEl?.focus())
	}

	function ctxRemoveDescription() {
		descriptionSlotOpen = false
		if (item.kind === 'quote') {
			patchLibraryItem(item.id, { quoteText: undefined, snippet: undefined })
		} else {
			patchLibraryItem(item.id, { snippet: undefined })
		}
	}

	function ctxAddSource() {
		const placeholderUrl = 'https://example.com'
		const s = item.source
		if (!s) {
			patchLibraryItem(item.id, {
				source: { id: 'web', name: 'Web', icon: '🔗', url: placeholderUrl }
			})
			return
		}
		if (s.url?.trim()) return
		patchLibraryItem(item.id, { source: { ...s, url: placeholderUrl } })
	}

	function ctxDelete() {
		void global.onDeleteItem(item.id)
	}

	function commitTitle() {
		if (!titleEl) return
		const t = titleEl.innerText.replace(/\s+/g, ' ').trim()
		const cur = (item.title ?? '').trim()
		if (t === cur) {
			if (!t) titleSlotOpen = false
			return
		}
		if (!t) {
			titleSlotOpen = false
			patchLibraryItem(item.id, { title: undefined })
			return
		}
		titleSlotOpen = true
		patchLibraryItem(item.id, { title: t })
	}

	function commitSubtitle() {
		if (!snippetEl) return
		const t = snippetEl.innerText.replace(/\s+/g, ' ').trim()
		if (item.kind === 'quote') {
			const cur = (item.quoteText ?? item.snippet ?? '').trim()
			if (t === cur) {
				if (!t) descriptionSlotOpen = false
				return
			}
			if (!t) {
				patchLibraryItem(item.id, { quoteText: undefined, snippet: undefined })
				descriptionSlotOpen = false
				return
			}
			patchLibraryItem(item.id, { quoteText: t })
		} else {
			const cur = (item.snippet ?? '').trim()
			if (t === cur) {
				if (!t) descriptionSlotOpen = false
				return
			}
			if (!t) {
				patchLibraryItem(item.id, { snippet: undefined })
				descriptionSlotOpen = false
				return
			}
			patchLibraryItem(item.id, { snippet: t })
		}
	}

	/* utils */

	function surfaceKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null
		if (el?.closest?.('[contenteditable="true"]')) return
		if (e.key !== 'Enter' && e.key !== ' ') return
		e.preventDefault()
	}

	function stopSurface(e: Event) {
		e.stopPropagation()
	}
</script>

<svelte:window onkeydown={onCardWindowKeydown} />


<FloatInput
	dmenuId={imgFloatDmenuId}
	bind:hidden={imgFloatHidden}
	bind:value={imgLinkDraft}
	inputType="imgUrl"
	placeholder="Paste or type image URL…"
	onClose={closeImgFloat}
	onPress={submitImgFloat}
	submitReady={Boolean(imgSubmitShowArrow && extractUrl(imgLinkDraft))}
	submitJitter={imgSubmitJitter}
	onImgUpload={openImgFilePicker}
	isDisabled={imgSubmitValidating}
/>

<FloatInput
	dmenuId={tagEditFloatDmenuId}
	bind:hidden={tagEditFloatHidden}
	bind:value={tagEditDraft}
	bind:tagColor={tagEditColor}
	bind:inputRef={tagEditInputEl}
	position={tagEditFloatPos}
	placeholder="Tag name…"
	inputType="tag"
	onClose={closeTagEditFloat}
	onPress={submitTagEditFromCard}
/>

<input
	type="file"
	accept="image/*"
	class="content-card__img-file"
	aria-hidden="true"
	tabindex="-1"
	bind:this={imgFileInputEl}
	onchange={onImgFilePicked}
/>
<article
	class="content-card"
	class:content-card--bare={hasImage && item.isBare !== false}
	class:content-card--no-img={!hasImage}
	style:--img-aspect-ratio={cardImgAspectRatio}
	data-kind={item.kind}
>
	<div
		class="content-card__surface"
		role="button"
		tabindex="0"
		data-idx={item.idx}
		onkeydown={surfaceKeydown}
		oncontextmenu={openCardContextMenu}
	>
		{#if item.media?.type === 'image' && mediaImageUrl}
			<div class="content-card__media">
				<img
					class="content-card__img content-card__img--aspect"
					class:content-card__img--intrinsic={useIntrinsicMediaRatio}
					src={mediaImageUrl}
					alt=""
					loading="lazy"
					decoding="async"
					ondblclick={onMediaDblClick}
				/>
			</div>
		{:else if item.media?.type === 'video' && mediaVideoUrl}
			<div class="content-card__media">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					class="content-card__img content-card__img--aspect"
					class:content-card__img--intrinsic={useIntrinsicMediaRatio}
					src={mediaVideoUrl}
					loop
					muted
					playsinline
					preload="metadata"
					aria-label="Video — hover to play"
					onpointerenter={onVideoThumbPointerEnter}
					onpointerleave={onVideoThumbPointerLeave}
					ondblclick={onMediaDblClick}
				></video>
			</div>
		{/if}
		<div class="content-card__body">
			{#if sourceLine || dateLine}
				<div class="content-card__row">
					{#if sourceLine && item.source}
						<SourceLink
							source={item.source}
							class="content-card__src"
							menuScope={item.id}
							onRemoveUrl={() => {
								const s = item.source
								if (!s?.url) return
								patchLibraryItem(item.id, { source: undefined, url: undefined })
							}}
							onSetUrl={(url) => {
								const s = item.source
								if (!s) return
								const { customName: _c, ...noCustom } = s
								patchLibraryItem(item.id, { source: { ...noCustom, url } })
							}}
							onSetCustomName={(customName) => {
								const s = item.source
								if (!s) return
								if (customName === undefined) {
									const { customName: _d, ...rest } = s
									patchLibraryItem(item.id, { source: rest })
									return
								}
								patchLibraryItem(item.id, { source: { ...s, customName } })
							}}
						/>
					{/if}
					{#if dateLine}
						<span class="content-card__date">{dateLine}</span>
					{/if}
				</div>
			{/if}
			{#if showTitleBlock}
				<div
					bind:this={titleEl}
					class="content-card__title content-card__editable"
					contenteditable="true"
					role="heading"
					aria-level="3"
					aria-label="Title"
					data-placeholder="Add title…"
					onpointerdown={stopSurface}
					onblur={commitTitle}
				></div>
			{/if}
			{#if showDescriptionBlock}
				<div
					bind:this={snippetEl}
					class="content-card__snippet content-card__editable"
					contenteditable="true"
					tabindex="0"
					role="textbox"
					aria-multiline="true"
					aria-label="Subtitle"
					data-placeholder="Add subtitle…"
					onpointerdown={stopSurface}
					onblur={commitSubtitle}
				></div>
			{/if}
			{#if cardTagChips.length}
				<div class="content-card__foot">
					<ul class="content-card__tags" aria-label="Tags">
						{#each cardTagChips as chip (chip.id)}
							<li class="content-card__tag-item">
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="content-card__hash-tag"
									class:underlined={tagUnderlineTagId === chip.id}
									oncontextmenu={(e) => openTagContextMenu(e, chip.id)}
								>#{hashTagLabel(chip.name)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
	</div>
	</div>
</article>

{#if mediaModalOpen}
	<Modal
		fitContent
		options={{
			scaleUp: true,
			overflowX: 'visible',
			overflowY: 'visible',
			height: 'auto'
		}}
		onClickOutSide={() => closeMediaModal()}
	>
		{#snippet children()}
			<div class="content-card__media-modal">
				{#if mediaModalIsVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={mediaModalVideoEl}
						class="content-card__media-modal-el"
						src={mediaModalSrc}
						autoplay
						controls
						playsinline
						preload="metadata"
					></video>
				{:else}
					<img class="content-card__media-modal-el" src={mediaModalSrc} alt="" />
				{/if}
			</div>
		{/snippet}
	</Modal>
{/if}

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.content-card__media-modal {
		line-height: 0;
	}

	.content-card__media-modal-el {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: min(85vh, calc(100vh - 120px));
		object-fit: contain;
	}

	.content-card__img-file {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.content-card {
		--img-aspect-ratio: 1 / 1.07;
		--outer-radius: 26px;
		--inner-radius: 18px;
		--pad-inline: max(16px, calc(var(--outer-radius) * 0.42));
		--pad-top: 12px;
		--pad-bottom: 15px;
		--surface-padding: 2px 12px 15px;

		width: 100%;

		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border: 1px solid rgba(0, 0, 0, 0.03);
		overflow: hidden;
		transition: box-shadow 0.18s ease, transform 0.18s ease;
		border-radius: var(--outer-radius);
		border: 1px dashed rgba(0, 0, 0, 0.07);
		
		&--no-img {
			--outer-radius: 16px;
			--surface-padding: 1px 8px 8px 8px;
		}
		&--bare {
			background: transparent;
			border: none;
			border-radius: 0;
		}
		&--bare &__surface {
			padding: 2px 4px 15px;
		}
		&--bare &__img {
			border-radius: 2px !important;
		}
		&--bare &__body {
			padding-left: 0 !important;
			padding-right: 0 !important;
		}
		&--bare &__foot {
			padding-left: 0 !important;
			padding-right: 0 !important;
		}

		&__surface:has(&__media) {
			--surface-padding: 8px 8px 8px;

			& > .content-card__body,
			& > .content-card__foot {
				padding-left: 6px;
				padding-right: 6px;
			}

			& > .content-card__body {
				padding-top: 12px;
			}

			& > .content-card__foot {
				padding-top: 12px;
				padding-bottom: 0;
			}

			& > .content-card__media .content-card__img {
				border-radius: var(--inner-radius);
			}
		}

		&__surface {
			display: flex;
			flex-direction: column;
			flex: 1;
			min-height: 0;
			min-width: 0;
			text-align: left;
			padding: var(--surface-padding);

			&:focus {
				outline: none;
			}

			&:focus-visible {
				@include border-focus;
			}
		}

		&__media {
			position: relative;

			&:has(.content-card__img--aspect) {
				line-height: 0;
			}
		}
		&__img {
			&--aspect {
				display: block;
				width: 100%;
				max-width: 100%;
				height: auto;
				aspect-ratio: var(--img-aspect-ratio, 1 / 1.07);
				object-fit: cover;
			}

			&--aspect:is(video) {
				background: rgba(0, 0, 0, 0.04);
			}

			&--aspect.content-card__img--intrinsic {
				aspect-ratio: auto;
				object-fit: contain;
			}
		}
		&__body {
			padding: 12px 4px 2px;
		}
		&__row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
			margin-bottom: 6px;
		}
		&__date {
			@include text-style(0.38, 400, 1.1rem);
			flex-shrink: 0;
			white-space: nowrap;
		}
		&__title {
			@include text-style(0.92, 400, 1.4rem);
			line-height: 1.25;
			margin: 0 0 2px;
		}
		&__snippet {
			@include text-style(0.52, 400, 1.25rem);
			line-height: 1.45;
			margin: 6px 0 5px 0;
		}

		&__editable {
			outline: none;
			cursor: text;
		}

		&__title.content-card__editable {
			min-height: 1.25em;

			&:empty::before {
				content: attr(data-placeholder);
				color: rgba(0, 0, 0, 0.28);
				pointer-events: none;
			}
		}

		&__snippet.content-card__editable {
			min-height: 1.35em;

			&:empty::before {
				content: attr(data-placeholder);
				color: rgba(0, 0, 0, 0.28);
				pointer-events: none;
			}
		}
		&__foot {
			display: block;
			min-width: 0;
			padding-top: 14px;
		}
		&__tags {
			display: flex;
			flex-wrap: nowrap;
			gap: 12px;
			overflow-x: auto;
			overflow-y: hidden;
			padding: 0 0 2px;
			margin: 0;
			list-style: none;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: thin;
		}
		&__tag-item {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			cursor: pointer;
		}
		&__hash-tag {
			@include text-style(0.3, 400, 1.2rem);
			white-space: nowrap;

			&:hover {
				text-decoration: underline;
			}
		}
	}
</style>
