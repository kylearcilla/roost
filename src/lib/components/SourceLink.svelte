<script lang="ts">
	import FloatInput from '$lib/components/FloatInput.svelte'
	import { abs, cursorPos } from '$lib'
	import { extractUrl, sourceDisplayShort, sourceFaviconUrl } from '$lib/lib/collection-sources'
	import '../../scss/dropdown.scss'

	type Props = {
		source: ContentSource
		class?: string
		/** Stable id (e.g. content `item.id`) when context menu + pill handlers are set */
		menuScope?: string
		onRemoveUrl?: () => void
		onSetUrl?: (url: string) => void
		/** `undefined` clears `customName` (auto label from URL again) */
		onSetCustomName?: (customName: string | undefined) => void
	}

	let {
		source,
		class: klass = '',
		menuScope,
		onRemoveUrl,
		onSetUrl,
		onSetCustomName
	}: Props = $props()

	const favicon = $derived(sourceFaviconUrl(source))
	const showFavicon = $derived(Boolean(favicon))
	const label = $derived(sourceDisplayShort(source))

	const linkCtxEnabled = $derived(
		Boolean(source.url && menuScope && onRemoveUrl && onSetUrl && onSetCustomName)
	)
	const ctxMenuId = $derived(`ctx-source-link-${menuScope ?? 'x'}`)
	const pillDmenuId = $derived(`source-link-pill-${menuScope ?? 'x'}`)

	let pillHidden = $state(true)
	let pillMode = $state<'url' | 'rename'>('url')
	let linkDraft = $state('')
	let pillInputEl = $state<HTMLInputElement | null>(null)
	let submitJitter = $state(false)
	let submitShowArrow = $state(false)

	$effect(() => {
		if (pillMode !== 'url') return
		if (linkDraft.trim() !== '') return
		submitShowArrow = false
	})

	const ctxItems: DropdownItem[] = [
		{ type: 'btn', label: 'Replace source', id: 'replace' },
		{ type: 'btn', label: 'Rename source', id: 'rename' },
		{ type: 'divider' },
		{ type: 'btn', label: 'Delete source', id: 'delete' }
	]

	function closePill() {
		pillHidden = true
		pillMode = 'url'
		linkDraft = ''
		submitShowArrow = false
	}

	function openSourceContextMenu(e: MouseEvent) {
		if (!linkCtxEnabled) return
		e.preventDefault()
		e.stopPropagation()
		closePill()
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: ctxMenuId,
			items: ctxItems,
			dims: { width: 140 },
			offset: { top: 0, left: 0 },
			menuGlass: false,
			onOptnClick: (label, itemId) => {
				const del = itemId === 'delete' || label === 'Delete source'
				const rep = itemId === 'replace' || label === 'Replace source'
				const ren = itemId === 'rename' || label === 'Rename source'
				abs.close(ctxMenuId)
				if (del) {
					onRemoveUrl?.()
					closePill()
				} else if (rep) {
					pillMode = 'url'
					linkDraft = ''
					submitShowArrow = false
					pillHidden = false
				} else if (ren) {
					pillMode = 'rename'
					linkDraft = source.customName?.trim() ?? ''
					submitShowArrow = false
					pillHidden = false
				}
			}
		})
	}

	function triggerSubmitJitter() {
		submitJitter = true
		window.setTimeout(() => submitJitter = false, 320)
	}

	function submitRenamePill() {
		const t = linkDraft.trim()
		onSetCustomName?.(t === '' ? undefined : t)
		closePill()
	}

	function submitLinkPill() {
		const raw = linkDraft.trim()
		if (!raw) return
		const extracted = extractUrl(linkDraft)

		if (!extracted) {
			if (raw) triggerSubmitJitter()
			submitShowArrow = false
			return
		}
		if (!submitShowArrow) {
			submitShowArrow = true
			return
		}
		const again = extractUrl(linkDraft)
		if (!again) {
			triggerSubmitJitter()
			submitShowArrow = false
			return
		}
		onSetUrl?.(again.href)
		closePill()
	}

	function submitPill() {
		if (pillMode === 'rename') {
			submitRenamePill()
			return
		}
		submitLinkPill()
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return
		if (!pillHidden) {
			e.preventDefault()
			closePill()
		}
		abs.close(ctxMenuId)
	}

</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if source.url}
	<a
		class="source-link {klass}"
		href={source.url}
		target="_blank"
		rel="noopener noreferrer"
		title={source.name}
		aria-label={`${label} (opens in new tab)`}
		oncontextmenu={openSourceContextMenu}
	>
		{#if showFavicon}
			<img class="source-link__favicon" src={favicon} alt="" width="14" height="14" loading="lazy" />
		{:else}
			<span class="source-link__emoji" aria-hidden="true">{source.icon}</span>
		{/if}
		<span class="source-link__name">{label}</span>
	</a>
{:else}
	<span class="source-link {klass}" title={source.name} aria-label={label}>
		{#if showFavicon}
			<img class="source-link__favicon" src={favicon} alt="" width="14" height="14" loading="lazy" />
		{:else}
			<span class="source-link__emoji" aria-hidden="true">{source.icon}</span>
		{/if}
		<span class="source-link__name">{label}</span>
	</span>
{/if}

{#if linkCtxEnabled}
	<FloatInput
		dmenuId={pillDmenuId}
		bind:hidden={pillHidden}
		bind:value={linkDraft}
		bind:inputRef={pillInputEl}
		inputType={pillMode === 'rename' ? 'text' : 'url'}
		placeholder={pillMode === 'rename' ? 'custom link label…' : 'type or paste link here...'}
		onClose={closePill}
		onPress={submitPill}
		submitReady={pillMode === 'url' && Boolean(submitShowArrow && extractUrl(linkDraft))}
		allowEmptySubmit={pillMode === 'rename'}
		{submitJitter}
	/>
{/if}

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.source-link {
		@include text-style(0.45, 500, 1.15rem);
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		max-width: 100%;
		color: inherit;
		text-decoration: none;
	}

	a.source-link {
		cursor: pointer;

		&:hover .source-link__name {
			text-decoration: underline;
		}
	}

	span.source-link {
		cursor: default;
	}

	.source-link__favicon {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		object-fit: contain;
	}

	.source-link__emoji {
		flex-shrink: 0;
		font-size: 1.05rem;
		line-height: 1;
	}

	.source-link__name {
		min-width: 0;
		@include truncate-lines(1);
	}
</style>
