<script lang="ts">
	import '../scss/app.scss'
	import { v4 as uuidv4 } from 'uuid'

	import AbsFloatElem from '$lib/components/AbsFloatElem.svelte'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import { cursorPos } from '$lib/float/cursor.svelte'
	import favicon from '$lib/assets/favicon.svg'
	import { browser } from '$app/environment'
	import {
		ELECTRON_CHROME_INSET_CTX,
		type ElectronChromeInsetBox
	} from '$lib/electronChromeInsetContext'
	import { use_mocks } from '$lib/env'
	import { db } from '$lib/lib/DBManager'
	import { global } from '$lib/lib/global.svelte'
	import { onMount, setContext } from 'svelte'
	import { extractUrl } from '$lib/lib/collection-sources'
	import {
		persistVolatileImageHref,
		saveImportedUserFile,
		storedImageSrc,
		type ImportedMediaStoreScope
	} from '$lib/lib/importedMedia'
	import { DEFAULT_IMG_UPLOAD_CONSTRAINTS, validateImgURL } from '$lib/lib/fetch-content'

	let { children } = $props()

	function roostTitleBarInset(): boolean {
		return typeof window !== 'undefined' && Boolean(window.roost?.insetTitleBar)
	}

	const electronChromeInset = $state<ElectronChromeInsetBox>({
		active: browser && roostTitleBarInset()
	})
	setContext(ELECTRON_CHROME_INSET_CTX, electronChromeInset)

	const CHROME_WALLPAPER_FLOAT_ID = 'chrome-wallpaper-float'

	const selectedCollection = $derived(global.currCollection ?? global.collections[0] ?? undefined)

	function wallpaperImportStore(): ImportedMediaStoreScope | null {
		const c = selectedCollection
		if (!c) return null
		return { scope: 'collection', collectionId: c.id, collectionName: c.name }
	}

	const hasWallpaper = $derived.by(() => {
		const c = selectedCollection
		if (!c) return false
		const w = c.wallpaper
		if (!w) return false
		return Boolean(w?.url?.trim() || w?.path?.trim())
	})

	let chromeHovered = $state(false)
	let imgFloatHidden = $state(true)
	let imgLinkDraft = $state('')
	let imgSubmitJitter = $state(false)
	let imgSubmitShowArrow = $state(false)
	let imgSubmitValidating = $state(false)
	let imgFileInputEl = $state<HTMLInputElement | null>(null)

	const showChromeWallpaper = $derived(chromeHovered || !imgFloatHidden)

	onMount(() => {
		electronChromeInset.active = roostTitleBarInset()
		if (browser && !use_mocks && db.isAvailable) {
			void (async () => {
				await global.hydrateFromDb()
				await global.fetchUser()
			})()
		}
	})

	$effect(() => {
		if (imgFloatHidden) return
		if (imgLinkDraft.trim() !== '') return
		imgSubmitShowArrow = false
	})

	function closeWallpaperFloat() {
		imgFloatHidden = true
		imgLinkDraft = ''
		imgSubmitShowArrow = false
	}

	function openWallpaperFloat() {
		imgLinkDraft = ''
		imgSubmitShowArrow = false
		imgFloatHidden = false
	}

	function triggerImgSubmitJitter() {
		imgSubmitJitter = true
		window.setTimeout(() => (imgSubmitJitter = false), 320)
	}

	async function applyWallpaperMedia(patch: { url?: string; path?: string }) {
		const c = selectedCollection
		if (!c) return
		await global.updateCollection({
			...c,
			wallpaper: { id: uuidv4(), type: 'image', url: patch.url, path: patch.path, dims: 'auto' },
			wallpaperFocusY: undefined
		})
	}

	async function applyWallpaperHref(href: string) {
		if (href.startsWith('blob:') || href.startsWith('data:')) {
			const st = wallpaperImportStore()
			if (!st) return
			const r = await persistVolatileImageHref(href, st)
			if ('path' in r) await applyWallpaperMedia({ path: r.path })
			else await applyWallpaperMedia({ url: r.url })
			return
		}
		await applyWallpaperMedia({ url: href })
	}

	function openWallpaperFilePicker() {
		imgFileInputEl?.click()
	}

	async function onWallpaperFilePicked(e: Event) {
		const el = e.currentTarget as HTMLInputElement
		const file = el.files?.[0]
		el.value = ''
		if (!file || !file.type.startsWith('image/')) return
		const st = wallpaperImportStore()
		if (!st) return
		const saved = await saveImportedUserFile(file, st)
		if (saved.ok) await applyWallpaperMedia({ path: saved.absolutePath })
		else await applyWallpaperHref(URL.createObjectURL(file))
		closeWallpaperFloat()
	}

	async function submitWallpaperFloat() {
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
			await applyWallpaperHref(href)
			closeWallpaperFloat()
			return
		}
		imgSubmitValidating = true
		try {
			await validateImgURL({ url: href, constraints: DEFAULT_IMG_UPLOAD_CONSTRAINTS })
			await applyWallpaperHref(href)
			closeWallpaperFloat()
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return
			triggerImgSubmitJitter()
			imgSubmitShowArrow = false
		} finally {
			imgSubmitValidating = false
		}
	}

	function onChromeWallpaperKeydown(e: KeyboardEvent) {
		if (!electronChromeInset.active || global.onHomePage) return
		if (e.key !== 'Escape') return
		if (!imgFloatHidden) {
			e.preventDefault()
			closeWallpaperFloat()
		}
	}

	function onPointerMove(e: PointerEvent) {
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
	}
</script>

<svelte:window on:pointermove={onPointerMove} onkeydown={onChromeWallpaperKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="main">
	{#if electronChromeInset.active}
		<div class="electron-chrome-row">
			<div class="electron-chrome-drag" aria-hidden="true"></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="electron-chrome-trailing"
				onmouseenter={() => (chromeHovered = true)}
				onmouseleave={() => (chromeHovered = false)}
			>
				<button
					type="button"
					class="lib-header__wallpaper-btn"
					class:lib-header__wallpaper-btn--visible={showChromeWallpaper}
					onclick={(e) => {
						e.stopPropagation()
						openWallpaperFloat()
					}}
				>
					{hasWallpaper ? 'Change Wallpaper' : 'Add Wallpaper'}
				</button>
				<div class="lib-header__user">
					<button type="button" class="lib-header__user-name" onclick={() => {}}>
						{global.user?.displayName?.trim() || 'You'}
					</button>
					{#if global.user?.avatarUrl}
						<img
							class="lib-header__avatar"
							src={storedImageSrc(global.user.avatarUrl)}
							alt=""
							width="36"
							height="36"
						/>
					{/if}
				</div>
				<FloatInput
					dmenuId={CHROME_WALLPAPER_FLOAT_ID}
					bind:hidden={imgFloatHidden}
					bind:value={imgLinkDraft}
					inputType="imgUrl"
					position={{ top: 44, right: 16 }}
					positionMode="fixed"
					placeholder="Paste or type image URL…"
					onClose={closeWallpaperFloat}
					onPress={submitWallpaperFloat}
					submitReady={Boolean(imgSubmitShowArrow && extractUrl(imgLinkDraft))}
					submitJitter={imgSubmitJitter}
					onImgUpload={openWallpaperFilePicker}
					isDisabled={imgSubmitValidating}
				/>
			</div>
		</div>
	{/if}

	<div class="main__content">
		{@render children()}
	</div>
</div>


<AbsFloatElem />

<input
	type="file"
	
	accept="image/*"
	class="lib-header__wallpaper-file"
	aria-hidden="true"
	tabindex="-1"
	bind:this={imgFileInputEl}
	onchange={onWallpaperFilePicked}
/>

<style lang="scss">
	@use '../scss/mixins.scss' as *;
	.main {
		height: 100dvh;
		max-height: 100dvh;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		&__content {
			flex: 1;
			min-height: 0;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}
	}
	.electron-chrome-row {
		display: flex;
		align-items: center;
		min-height: 35px;
		flex-shrink: 0;
		background: var(--bg-color);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}
	.electron-chrome-drag {
		flex: 1;
		min-width: 72px;
		height: var(--chrom-drah-height);
		-webkit-app-region: drag;
	}
	.electron-chrome-trailing {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-shrink: 0;
		padding-right: 10px;
		-webkit-app-region: no-drag;
	}

	.lib-header {
		&__wallpaper-file {
			position: absolute;
			width: 0;
			height: 0;
			opacity: 0;
			pointer-events: none;
		}
		&__wallpaper-btn {
			border: none;
			background: none;
			padding: 0;
			cursor: pointer;
			font-family: inherit;
			white-space: nowrap;
			@include text-style(0.4, 400, 1.2rem);
			@include visible(0);
	
			&--visible {
				@include visible(0.6);
			}
			&:hover {
				@include text-style(0.52, 400, 1.2rem);
			}
		}
		&__user {
			display: flex;
			align-items: center;
			gap: 12px;
			flex-shrink: 0;
		}
		&__user-name {
			@include text-style(0.55, 400, 1.2rem);
			border: none;
			background: none;
			padding: 0;
			cursor: pointer;
			font-family: inherit;
			&:hover {
				text-decoration: underline;
			}
		}
		&__avatar {
			border-radius: 50%;
			object-fit: cover;
			width: 20px;
			height: 20px;
		}
	}

</style>
