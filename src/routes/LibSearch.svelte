<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte'
	import { global } from '$lib/lib/global.svelte'
	import { addLibraryItemFromMetadata, addLibraryTitleItem } from '$lib/libraryContent.svelte'
	import { fetchContentMetadata } from '$lib/lib/fetch-content'

	let {
		linkInput = $bindable(''),
		isSearching = $bindable(false)
	}: {
		linkInput?: string
		isSearching?: boolean
	} = $props()

	const onHome = $derived(global.onHomePage)
	const placeholder = $derived(
		onHome
			? 'Search all items by title, tag, source, or text…'
			: 'Insert link to article, book, video, media post, or web page goes here...'
	)
	const plusDisabled = $derived(
		onHome ? linkInput.trim() === '' : linkInput.trim() === '' || isSearching
	)
	const searchMode = $derived(onHome || linkInput.trim().startsWith('#'))

	/** `"My title"` or `"partial` → plain title; not a URL. */
	function titleFromLeadingQuote(raw: string): string | null {
		const t = raw.trim()
		if (!t.startsWith('"')) return null
		const body = t.slice(1).trimStart()
		if (!body) return null
		if (body.endsWith('"')) {
			const inner = body.slice(0, -1).trim()
			return inner.length ? inner : null
		}
		const out = body.trim()
		return out.length ? out : null
	}

	async function runSearch() {
		if (onHome && !searchMode) return
		const u = linkInput.trim()
		if (!u || isSearching) return

		const quotedTitle = titleFromLeadingQuote(u)
		if (quotedTitle !== null) {
			isSearching = true
			try {
				const row = addLibraryTitleItem({
					title: quotedTitle,
					collectionId: global.selectedCollectionId,
					activeTagFilter: global.currFilterTab
				})
				global.onAddItem(row.id)
				linkInput = ''
			} finally {
				isSearching = false
			}
			return
		}

		isSearching = true
		try {
			const data = await fetchContentMetadata(u)
			const row = addLibraryItemFromMetadata({
				meta: data,
				collectionId: global.selectedCollectionId,
				activeTagFilter: global.currFilterTab
			})
			global.onAddItem(row.id)
			linkInput = ''
		} catch (err) {
			console.error('[LibSearch] metadata fetch error', err)
		} 
		finally {
			isSearching = false
		}
	}

	function onPlusClick() {
		if (onHome) {
			if (searchMode) {
				void runSearch()
				return
			}
			if (linkInput.trim()) linkInput = ''
			return
		}
		if (searchMode) {
			if (linkInput.trim()) linkInput = ''
			return
		}
		void runSearch()
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return
		e.preventDefault()
		if (onHome) {
			if (searchMode) {
				void runSearch()
				return
			}
			;(e.currentTarget as HTMLInputElement).blur()
			return
		}
		if (searchMode) {
			;(e.currentTarget as HTMLInputElement).blur()
			return
		}
		void runSearch()
	}
</script>

<div class="lib-search">
	<button
		type="button"
		class="lib-search__plus"
		class:lib-search__plus--busy={isSearching}
		class:lib-search__plus--home={onHome && !searchMode}
		disabled={plusDisabled}
		aria-busy={isSearching}
		aria-label={onHome
			? linkInput.trim()
				? 'Clear search'
				: 'Search'
			: isSearching
				? 'Adding'
				: 'Add'}
		onclick={onPlusClick}
	>
		{#if isSearching}
			<Spinner scale={0.65} bg="#1a1a1a" />
		{:else if searchMode}
			<div class="lib-search__search-icon">
				<svg width="79" height="79" viewBox="0 0 79 79" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M31.7354 0C49.2661 0 63.4706 14.2046 63.4707 31.7354C63.4707 38.7384 61.1977 45.2075 57.3682 50.4561L76.6836 69.7871C78.5908 71.6943 78.5908 74.792 76.6836 76.6992C74.7764 78.6062 71.6796 78.6062 69.7725 76.6992L50.4561 57.3682C45.2075 61.2129 38.7384 63.4707 31.7354 63.4707C14.2046 63.4706 0 49.2661 0 31.7354C6.2334e-05 14.2046 14.2046 6.23378e-05 31.7354 0ZM31.7354 9.76465C28.8503 9.76466 25.9936 10.3335 23.3281 11.4375C20.6625 12.5416 18.2404 14.16 16.2002 16.2002C14.16 18.2404 12.5416 20.6625 11.4375 23.3281C10.3335 25.9936 9.76466 28.8503 9.76465 31.7354C9.76465 34.6206 10.3334 37.4779 11.4375 40.1436C12.5416 42.809 14.1601 45.2314 16.2002 47.2715C18.2403 49.3115 20.6627 50.9301 23.3281 52.0342C25.9935 53.1381 28.8504 53.706 31.7354 53.7061C34.6206 53.7061 37.4779 53.1383 40.1436 52.0342C42.8091 50.93 45.2313 49.3116 47.2715 47.2715C49.3116 45.2313 50.93 42.8091 52.0342 40.1436C53.1383 37.4779 53.7061 34.6206 53.7061 31.7354C53.706 28.8504 53.1381 25.9935 52.0342 23.3281C50.9301 20.6627 49.3115 18.2403 47.2715 16.2002C45.2314 14.1601 42.809 12.5416 40.1436 11.4375C37.4779 10.3334 34.6206 9.76465 31.7354 9.76465Z" fill="black"/>
					<path d="M31.7354 0C49.2661 0 63.4706 14.2046 63.4707 31.7354C63.4707 38.7384 61.1977 45.2075 57.3682 50.4561L76.6836 69.7871C78.5908 71.6943 78.5908 74.792 76.6836 76.6992C74.7764 78.6062 71.6796 78.6062 69.7725 76.6992L50.4561 57.3682C45.2075 61.2129 38.7384 63.4707 31.7354 63.4707C14.2046 63.4706 0 49.2661 0 31.7354C6.2334e-05 14.2046 14.2046 6.23378e-05 31.7354 0ZM31.7354 9.76465C28.8503 9.76466 25.9936 10.3335 23.3281 11.4375C20.6625 12.5416 18.2404 14.16 16.2002 16.2002C14.16 18.2404 12.5416 20.6625 11.4375 23.3281C10.3335 25.9936 9.76466 28.8503 9.76465 31.7354C9.76465 34.6206 10.3334 37.4779 11.4375 40.1436C12.5416 42.809 14.1601 45.2314 16.2002 47.2715C18.2403 49.3115 20.6627 50.9301 23.3281 52.0342C25.9935 53.1381 28.8504 53.706 31.7354 53.7061C34.6206 53.7061 37.4779 53.1383 40.1436 52.0342C42.8091 50.93 45.2313 49.3116 47.2715 47.2715C49.3116 45.2313 50.93 42.8091 52.0342 40.1436C53.1383 37.4779 53.7061 34.6206 53.7061 31.7354C53.706 28.8504 53.1381 25.9935 52.0342 23.3281C50.9301 20.6627 49.3115 18.2403 47.2715 16.2002C45.2314 14.1601 42.809 12.5416 40.1436 11.4375C37.4779 10.3334 34.6206 9.76465 31.7354 9.76465Z" stroke="black"/>
				</svg>					
			</div>
		{:else}
			<span class="lib-search__plus-mark" aria-hidden="true">+</span>
		{/if}
	</button>
	<input
		class="lib-search__input"
		bind:value={linkInput}
		{placeholder}
		onkeydown={onInputKeydown}
	/>
</div>

<style lang="scss">
	@use '../scss/mixins.scss' as *;

	.lib-search {
		display: flex;
		align-items: center;
		gap: 3px;
		background: #ecece7;
		border-radius: 14px;
		padding: 8px 12px 8px 8px;
		margin: 0px 0px 18px -5px;
		transition: box-shadow 0.3s cubic-bezier(.4, 0, .2, 1);

		&:focus-within {
			box-shadow:
				rgba(#848484, 0.3) 0px 0px 0px 2px inset,
				rgba(#848484, 0.1) 0px 0px 0px 2.5px;
		}

		&__plus {
			position: relative;
			flex-shrink: 0;
			width: 32px;
			height: 32px;
			margin: 0;
			padding: 0;
			border: none;
			border-radius: 10px;
			background: rgba(0, 0, 0, 0.125);
			cursor: pointer;
			transition: background 0.12s ease-in-out, opacity 0.12s ease-in-out;
			opacity: 0.4;
			display: flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background: rgba(0, 0, 0, 0.1);
				opacity: 1;
			}
			&:disabled {
				opacity: 0.2;
			}
			&--busy:disabled {
				opacity: 1;
				cursor: wait;
			}
			&--home {
				pointer-events: none !important;
			}
		}
		&__plus-mark {
			@include text-style(1, 300, 1.7rem);
			color: black;
			position: absolute;
			left: 50%;
			top: 50%;
			line-height: 1;
			transform: translate(-50%, calc(-50% - 2px));

		}
		&__search-icon {
			opacity: 1;
			transition: opacity 0.12s ease-in-out;
			
			svg {
				width: 14px;
				margin-top: 3px
			}
		}
		&__input {
			flex: 1;
			min-width: 0;
			@include text-style(1, 400, 1.35rem);
			padding: 8px 6px;
			border: none;
			background: transparent;

			&::placeholder {
				color: rgba(var(--textColor1), 0.4);
			}
		}
	}
</style>
