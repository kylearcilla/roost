<script lang="ts">
	import BannerImg from '$lib/components/BannerImg.svelte'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import { ELECTRON_CHROME_INSET_CTX } from '$lib/electronChromeInsetContext'
	import { extractUrl } from '$lib/lib/collection-sources'
	import { DEFAULT_IMG_UPLOAD_CONSTRAINTS, validateImgURL } from '$lib/lib/fetch-content'
	import { global } from '$lib/lib/global.svelte'
	import { getContext } from 'svelte'
	import { libraryContent } from '$lib/libraryContent.svelte'

	type Props = {
		/** Optional external match count for non-home contexts. */
		homeItemCount?: number
	}
	let { homeItemCount }: Props = $props()

	const electronChromeInset = getContext<{ active: boolean } | undefined>(ELECTRON_CHROME_INSET_CTX)

	const HEADER_IMG_FLOAT_ID = 'header-collection-wallpaper-float'

	const selectedCollection = $derived(global.currCollection ?? global.collections[0])
	const currentCid = $derived(global.selectedCollectionId)

	const hasWallpaper = $derived.by(() => {
		const w = selectedCollection.wallpaper
		if (!w) return false
		return Boolean(w?.url?.trim() || w?.path?.trim())
	})

	const bannerSrc = $derived.by(() => {
		const w = selectedCollection.wallpaper
		if (!w || w.type !== 'image') return ''
		return (w.url ?? w.path ?? '').trim()
	})

	const wallpaperFocusY = $derived(selectedCollection.wallpaperFocusY ?? 50)
	let onHomePage = $derived(global.onHomePage)

	const allItemsCount = $derived(libraryContent.items.length)
	const homeCountLabel = $derived(onHomePage ? allItemsCount : (homeItemCount ?? allItemsCount))

	let titleEl = $state<HTMLDivElement | null>(null)
	let subtitleEl = $state<HTMLDivElement | null>(null)
	let headerHovered = $state(false)
	const hideHeaderWallpaperUi = $derived(
		Boolean(electronChromeInset?.active) && !onHomePage
	)
	let imgFloatHidden = $state(true)
	let imgLinkDraft = $state('')
	let imgSubmitJitter = $state(false)
	let imgSubmitShowArrow = $state(false)
	let imgSubmitValidating = $state(false)
	let imgFileInputEl = $state<HTMLInputElement | null>(null)

	const showAddWallpaper = $derived(
		!hideHeaderWallpaperUi && (headerHovered || !imgFloatHidden) && !hasWallpaper
	)

	$effect(() => {
		if (!hideHeaderWallpaperUi) return
		imgFloatHidden = true
		imgLinkDraft = ''
		imgSubmitShowArrow = false
		headerHovered = false
	})

	$effect(() => {
		const t = selectedCollection.headline ?? selectedCollection.name
		if (!titleEl) return
		if (document.activeElement === titleEl) return
		if (titleEl.textContent !== t) titleEl.textContent = t
	})

	$effect(() => {
		const sub = selectedCollection.subtitle ?? currentCid
		if (!subtitleEl) return
		if (document.activeElement === subtitleEl) return
		subtitleEl.textContent = sub
	})

	$effect(() => {
		if (imgFloatHidden) return
		if (imgLinkDraft.trim() !== '') return
		imgSubmitShowArrow = false
	})

	async function commitCollectionTitle(raw: string) {
		const next = raw.replace(/\s+/g, ' ').trim()
		const defaultName = selectedCollection.name.trim()
		const newHeadline =
			!next || next === defaultName ? undefined : next
		const prev = (selectedCollection.headline ?? '').trim()
		if ((newHeadline ?? '') === prev) return
		await global.updateCollection({ ...selectedCollection, headline: newHeadline })
	}

	async function commitCollectionSubtitle(raw: string) {
		const next = raw.replace(/\s+/g, ' ').trim()
		const cur = (selectedCollection.subtitle ?? '').trim()
		if (next === cur) return
		await global.updateCollection({ ...selectedCollection, subtitle: next || undefined })
	}

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

	async function applyWallpaperHref(href: string) {
		await global.updateCollection({
			...selectedCollection,
			wallpaper: { type: 'image', url: href, dims: 'auto' },
			wallpaperFocusY: undefined
		})
	}

	async function commitWallpaperFocusY(y: number) {
		await global.updateCollection({
			...selectedCollection,
			wallpaperFocusY: y
		})
	}

	async function removeBannerWallpaper() {
		await global.updateCollection({
			...selectedCollection,
			wallpaper: null,
			wallpaperFocusY: undefined
		})
	}

	function openWallpaperFilePicker() {
		imgFileInputEl?.click()
	}

	async function onWallpaperFilePicked(e: Event) {
		const el = e.currentTarget as HTMLInputElement
		const file = el.files?.[0]
		el.value = ''
		if (!file || !file.type.startsWith('image/')) return
		await applyWallpaperHref(URL.createObjectURL(file))
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

	function onHeaderWindowKeydown(e: KeyboardEvent) {
		if (hideHeaderWallpaperUi) return
		if (e.key !== 'Escape') return
		if (!imgFloatHidden) {
			e.preventDefault()
			closeWallpaperFloat()
		}
	}
</script>

<svelte:window onkeydown={onHeaderWindowKeydown} />

{#snippet userInfo()}
	<div class="lib-header__user">
		<button type="button" class="lib-header__user-name" onclick={() => {}}>
			{global.user.displayName}
		</button>
		{#if global.user.avatarUrl}
			<img
				class="lib-header__avatar"
				src={global.user.avatarUrl}
				alt=""
				width="36"
				height="36"
			/>
		{/if}
	</div>
{/snippet}

{#if onHomePage}
	<header 
		class="lib-header lib-header--home"
	>
		<div class="flx">
			<span class="lib-header--home__name">All</span>
			<span class="lib-header--home__count">({homeCountLabel})</span>
		</div>
		{@render userInfo()}
	</header>
{:else}
	<div class="lib-header-stack">
		{#if bannerSrc}
			<div class="lib-header__banner">
				{#key bannerSrc}
					<BannerImg
						src={bannerSrc}
						center={wallpaperFocusY}
						onCenterChange={(y) => void commitWallpaperFocusY(y)}
						onRemove={() => void removeBannerWallpaper()}
					/>
				{/key}
			</div>
		{/if}
		<header class="lib-header">
			<div
				class="lib-header__surface"
				role="group"
				aria-label="Library header"
				onmouseenter={() => {
					if (!hideHeaderWallpaperUi) headerHovered = true
				}}
				onmouseleave={() => {
					headerHovered = false
				}}
			>
				<div class="lib-header__titles">
					<div class="lib-header__heading-row">
						<!-- <div class="lib-header__icon" aria-hidden="true">{headerEmoji}</div> -->
						<h1
							bind:this={titleEl}
							class="lib-header__title"
							contenteditable="true"
							spellcheck="false"
							aria-label="Collection title"
							data-placeholder="Add a title…"
							onblur={(e) =>
								void commitCollectionTitle((e.currentTarget as HTMLHeadingElement).innerText)}
						></h1>
					</div>
					<div
						bind:this={subtitleEl}
						class="lib-header__sub"
						contenteditable="true"
						role="textbox"
						spellcheck="false"
						aria-multiline="true"
						aria-label="Collection description"
						data-placeholder="Add a description…"
						onblur={(e) =>
							void commitCollectionSubtitle((e.currentTarget as HTMLDivElement).innerText)}
					></div>
				</div>
				{#if !hideHeaderWallpaperUi}
					<div class="lib-header__right">
						<button
							type="button"
							class="lib-header__wallpaper-btn"
							class:lib-header__wallpaper-btn--visible={showAddWallpaper}
							onclick={(e) => {
								e.stopPropagation()
								openWallpaperFloat()
							}}
						>
							Add Wallpaper
						</button>
						{@render userInfo()}
					</div>
				{/if}
			</div>
			{#if !hideHeaderWallpaperUi}
				<FloatInput
					dmenuId={HEADER_IMG_FLOAT_ID}
					bind:hidden={imgFloatHidden}
					bind:value={imgLinkDraft}
					inputType="imgUrl"
					position={{ top: 50, right: 20 }}
					placeholder="Paste or type image URL…"
					onClose={closeWallpaperFloat}
					onPress={submitWallpaperFloat}
					submitReady={Boolean(imgSubmitShowArrow && extractUrl(imgLinkDraft))}
					submitJitter={imgSubmitJitter}
					onImgUpload={openWallpaperFilePicker}
					isDisabled={imgSubmitValidating}
				/>
			{/if}
		</header>
	</div>
{/if}


{#if !hideHeaderWallpaperUi}
	<input
		type="file"
		accept="image/*"
		class="lib-header__wallpaper-file"
		aria-hidden="true"
		tabindex="-1"
		bind:this={imgFileInputEl}
		onchange={onWallpaperFilePicked}
	/>
{/if}

<style lang="scss">
	@use '../scss/mixins.scss' as *;

	.lib-header__wallpaper-file {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	.lib-header-stack {
		margin-bottom: 18px;
	}

	.lib-header--home {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin: -6px 0 0px 0;
		padding-bottom: 12px;

		&__name {
			@include text-style(0.72, 500, 1.4rem);
			margin-right: 5px;
		}
		&__count {
			@include text-style(0.38, 400, 1.35rem);
		}
	}

	.lib-header {
		margin-bottom: 0;

		&__surface {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
            position: relative;
			width: 100%;
		}
		&__banner {
			position: relative;
            width: calc(100% + calc(var(--main-frame-padding-sides) * 2));
            margin: calc(var(--main-frame-padding-top) * -1) 0px 20px calc(var(--main-frame-padding-sides) * -1);
		}
		&__titles {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
			min-width: 0;
		}
		&__heading-row {
			display: flex;
			align-items: center;
			gap: 12px;
			min-width: 0;
		}
		&__icon {
			flex-shrink: 0;
			font-size: 2.4rem;
			line-height: 1;
			margin-top: 2px;
		}
		&__title {
			@include text-style(0.92, 400, 2.6rem);
			margin: 0;
			line-height: 1.1;
			min-width: 0;
			outline: none;
			cursor: text;

			&:empty::before {
				content: attr(data-placeholder);
				color: rgba(0, 0, 0, 0.28);
				pointer-events: none;
			}
		}
		&__sub {
			width: 100%;
			@include text-style(0.48, 400, 1.25rem);
			margin: 0;
			min-height: 1.35em;
			outline: none;
			cursor: text;

			&:empty::before {
				content: attr(data-placeholder);
				color: rgba(0, 0, 0, 0.28);
				pointer-events: none;
			}
		}

		&__right {
			display: flex;
			align-items: center;
			gap: 16px;
			flex-shrink: 0;
			margin-top: -4px;
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
			gap: 15px;
			flex-shrink: 0;
		}
		&__user-name {
			@include text-style(0.55, 400, 1.2rem);

            &:hover {
                text-decoration: underline;
            }
		}
		&__avatar {
			border-radius: 50%;
			object-fit: cover;
			width: 28px;
			height: 28px;
		}
	}
</style>
