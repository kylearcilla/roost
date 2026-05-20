<script lang="ts">
	import BounceFade, { type BounceFadeInset } from '$lib/components/BounceFade.svelte'
	import UploadIcon from '$lib/components/UploadIcon.svelte'
	import { cursorPos } from '$lib/float/cursor.svelte'
	import { extractUrl } from '$lib/lib/collection-sources'
	import { COLOR_SWATCHES, initFloatElemPos } from '$lib/lib/utils'

	/** `imgUrl`: URL chrome + live favicon; `tag`: text field + `Color` swatch dropdown */
	type FloatInputType = HTMLInputElement['type'] | 'imgUrl' | 'tag'

	type Props = {
		dmenuId: string
		hidden?: boolean
		/**
		 * Omit: snap `cursorPos` once on open, shell uses `position: fixed`.
		 * Set: use these coords with `position: absolute` on the shell.
		 */
		position?: BounceFadeInset
		zIndex?: number
		value?: string
		inputRef?: HTMLInputElement | null
		placeholder?: string
		inputType?: FloatInputType
		/** When `inputType === 'tag'`, fills the left block; parent can read on submit */
		tagColor?: Color
		onClose?: () => void
		onPress?: () => void
		submitReady?: boolean
		allowEmptySubmit?: boolean
		submitJitter?: boolean
		imgUrlEmptyGlyph?: string
		onImgUpload?: () => void
		isDisabled?: boolean
		/** When `position` is set, default is `absolute`; set `fixed` to anchor to the viewport. */
		positionMode?: 'fixed' | 'absolute'
	}

	let {
		dmenuId,
		hidden = $bindable(true),
		position: positionOverride,
		positionMode,
		zIndex = 25001,
		value = $bindable(''),
		inputRef = $bindable<HTMLInputElement | null>(null),
		placeholder = '',
		inputType = 'url',
		tagColor = $bindable<Color>({ ...COLOR_SWATCHES[0] }),
		onClose,
		onPress,
		submitReady = false,
		allowEmptySubmit = false,
		submitJitter = false,
		imgUrlEmptyGlyph,
		onImgUpload,
		isDisabled = false
	}: Props = $props()

	/** Last cursor anchor when opening without an explicit `position` prop. */
	let cursorOpenSnap = $state({ top: 0, left: 0 })
	let wasHidden = $state(true)

	$effect.pre(() => {
		if (positionOverride == null && wasHidden && !hidden) {
			const base = { top: cursorPos.top, left: cursorPos.left }
			const fixedToViewport = (positionMode ?? 'fixed') === 'fixed'
			if (fixedToViewport && typeof window !== 'undefined') {
				const floatW =
					inputType === 'imgUrl' || inputType === 'url' || inputType === 'tag' ? 300 : 280
				cursorOpenSnap = initFloatElemPos({
					dims: { width: floatW, height: 56 },
					cursorPos: base,
					margins: { ns: 8, ew: 8 }
				})
			} else {
				cursorOpenSnap = base
			}
		}
		wasHidden = hidden
	})

	const position = $derived(positionOverride ?? cursorOpenSnap)

	const bouncePosType = $derived<'fixed' | 'absolute'>(
		positionMode ?? (positionOverride != null ? 'absolute' : 'fixed')
	)

	const inputDomId = $derived(`float-input-${dmenuId.replace(/[^a-zA-Z0-9_-]/g, '-')}`)

	/** Never `type="url"` — browsers block spaces / odd chars while editing; `extractUrl` still validates. */
	const domInputType = $derived<HTMLInputElement['type']>(
		inputType === 'imgUrl' || inputType === 'url' ? 'text' : inputType === 'tag' ? 'text' : inputType
	)
	const fieldInputmode = $derived<'url' | undefined>(
		inputType === 'url' || inputType === 'imgUrl' ? 'url' : undefined
	)
	const fieldAutocomplete = $derived<'url' | undefined>(
		inputType === 'url' || inputType === 'imgUrl' ? 'url' : undefined
	)
	const showUrlChrome = $derived(inputType === 'url' || inputType === 'imgUrl')
	const showTagChrome = $derived(inputType === 'tag')
	const menuSkin = $derived(showUrlChrome ? 'url' : showTagChrome ? 'tag' : 'text')

	/** Parsed URL for favicon (only shown once parent sets `submitReady` — same step as ↑). */
	const urlTypePreview = $derived(
		showUrlChrome ? extractUrl(value) : null
	)

	const onArrow = $derived(submitReady)
	const faviconPreviewUrl = $derived(
		urlTypePreview && onArrow ? urlTypePreview.faviconUrl : null
	)
	const imgUrlFaviconClickable = $derived(
		inputType === 'imgUrl' && Boolean(onImgUpload) && !isDisabled
	)
	const showReset = $derived(
		onArrow ||
			allowEmptySubmit ||
			((inputType === 'text' || inputType === 'tag') && value.trim() !== '')
	)

	let tagColorPickerOpen = $state(false)

	function resetField() {
		value = ''
	}

	const submitDisabled = $derived(
		isDisabled || (value.trim() === '' && !onArrow && !allowEmptySubmit)
	)

	function handleClickOutside(_e: CustomEvent<{ target: HTMLElement; src: HTMLElement }>) {
		hidden = true
		onClose?.()
	}

	$effect(() => {
		if (hidden || isDisabled) return

		setTimeout(() => document.getElementById(inputDomId)?.focus(), 100)
	})

	$effect(() => {
		if (hidden) tagColorPickerOpen = false
	})

	$effect(() => {
		if (!tagColorPickerOpen) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation()
				tagColorPickerOpen = false
			}
		}
		window.addEventListener('keydown', onKey, true)
		return () => window.removeEventListener('keydown', onKey, true)
	})

	function pickTagColor(c: Color) {
		tagColor = { ...c }
		tagColorPickerOpen = false
	}
</script>

<BounceFade
	{dmenuId}
	isHidden={hidden}
	{position}
	posType={bouncePosType}
	{zIndex}
	onClickOutside={handleClickOutside}
>
	<div
		class="link-menu link-menu--{menuSkin}"
		class:link-menu--on-arrow={onArrow}
		class:link-menu--disabled={isDisabled}
	>
		{#if showUrlChrome}
			<button
				type="button"
				class="link-menu__favicon"
				class:link-menu__favicon--clickable={imgUrlFaviconClickable}
				class:link-menu__favicon--static={inputType === 'imgUrl' && !onImgUpload && !isDisabled}
				disabled={inputType === 'url' || isDisabled}
				aria-hidden={!imgUrlFaviconClickable}
				aria-label={imgUrlFaviconClickable ? 'Upload image from file' : undefined}
				onclick={(e) => {
					e.stopPropagation()
					if (inputType === 'imgUrl') onImgUpload?.()
				}}
			>
				{#if faviconPreviewUrl && inputType === 'url'}
					<img
						src={faviconPreviewUrl}
						alt=""
						width="17"
						height="17"
						loading="lazy"
					/>
				{:else if inputType === 'imgUrl'}
					<span class="link-menu__glyph" aria-hidden="true">
						{#if imgUrlEmptyGlyph}
							{imgUrlEmptyGlyph}
						{:else}
							<UploadIcon context="small" />
						{/if}
					</span>
				{:else}
					<span class="link-menu__glyph" aria-hidden="true">📰</span>
				{/if}
			</button>
		{:else if showTagChrome}
			<div class="link-menu__tag-color">
				<button
					type="button"
					class="link-menu__favicon link-menu__tag-swatch-btn"
					disabled={isDisabled}
					style:background-color={tagColor.primary}
					aria-label="Tag color"
					aria-haspopup="listbox"
					aria-expanded={tagColorPickerOpen}
					onclick={(e) => {
						e.stopPropagation()
						if (!isDisabled) tagColorPickerOpen = !tagColorPickerOpen
					}}
				></button>
				{#if tagColorPickerOpen}
					<div class="link-menu__tag-picker" role="group" aria-label="Choose tag color">
						{#each COLOR_SWATCHES as c (c.name)}
							<button
								type="button"
								class="link-menu__tag-picker-swatch"
								class:link-menu__tag-picker-swatch--selected={c.name === tagColor.name}
								style:background-color={c.primary}
								aria-label={c.name}
								onclick={(e) => {
									e.stopPropagation()
									pickTagColor(c)
								}}
							></button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		<input
			bind:this={inputRef}
			id={inputDomId}
			class="link-menu__field"
			type={domInputType}
			inputmode={fieldInputmode}
			autocomplete={fieldAutocomplete}
			{placeholder}
			bind:value={value}
			disabled={isDisabled}
			spellcheck={showUrlChrome ? false : undefined}
			onkeydown={(e) => {
				if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
				if (e.key !== 'Enter') return
				if (inputType !== 'tag' && inputType !== 'text') return
				if (submitDisabled) return
				e.preventDefault()
				onPress?.()
			}}
		/>
		<div class="link-menu__actions">
			{#if showReset}
				<button
					type="button"
					class="link-menu__reset"
					disabled={isDisabled}
					onclick={resetField}
				>
					×
				</button>
			{/if}
			<button
				type="button"
				class="link-menu__submit"
				class:link-menu__submit--active={submitReady}
				class:link-menu__submit--jitter={submitJitter}
				disabled={submitDisabled}
				onclick={() => onPress?.()}
			>
				<span aria-hidden="true">{onArrow ? '↑' : '+'}</span>
			</button>
		</div>
	</div>
</BounceFade>

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.link-menu {
		display: flex;
		align-items: center;
		gap: 10px;
		position: relative;
		z-index: 1000;
		width: 300px;
		padding: 7px 7px 7px 7px;
		border-radius: 14px;
		background-color: var(--bg-color);
		border: 1px solid rgba(white, 0.6);
        box-shadow: rgba(var(--textColor1), 0.05) 0px 0px 10px 1px;

		&--disabled {
			opacity: 0.48;
		}

		&--text {
			width: 280px;
			padding-left: 15px;
		}
		&--tag {
			width: 300px;
		}
		&__tag-color {
			position: relative;
			flex-shrink: 0;
		}
		&__tag-swatch-btn {
			cursor: pointer;
			border: 1px solid rgba(var(--textColor1), 0.12);
			&:disabled {
				cursor: not-allowed;
				opacity: 0.5;
			}
			&:not(:disabled):hover {
				filter: brightness(0.97);
			}
		}
		&__tag-picker {
			position: absolute;
			top: calc(100% + 6px);
			left: 0;
			z-index: 2;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 6px;
			padding: 8px;
			border-radius: 14px;
			background-color: var(--bg-color);
			border: 1px solid rgba(white, 0.6);
			box-shadow: rgba(var(--textColor1), 0.05) 0px 0px 10px 1px;
			min-width: 132px;
		}
		&__tag-picker-swatch {
			width: 26px;
			height: 26px;
			border-radius: 8px;
			border: 2px solid transparent;
			padding: 0;
			cursor: pointer;
			&:hover {
				filter: brightness(0.95);
			}
			&--selected {
				border-color: rgba(var(--textColor1), 0.45);
			}
		}
		&--on-arrow span {
			font-weight: 500 !important;
			font-size: 1.45rem !important;
			top: calc(50% - 1px) !important;
		}
		&__favicon {
			flex-shrink: 0;
			width: 28px;
			height: 28px;
			border: none;
			padding: 0;
			font: inherit;
			color: inherit;
			border-radius: 8px;
			overflow: hidden;
			background: rgba(var(--textColor1), 0.04);
			@include flex(center, center);

			img {
				width: 17px;
				height: 17px;
				object-fit: contain;
			}

			&:disabled {
				opacity: 1;
				cursor: default;
			}

			&--clickable:not(:disabled) {
				cursor: pointer;

				&:hover {
					background: rgba(var(--textColor1), 0.09);
				}
			}

			&--static {
				pointer-events: none;
				cursor: default;
			}
		}
		&__glyph {
			font-size: 1.15rem;
			line-height: 1;
		}
		&__field {
			flex: 1;
			min-width: 0;
			border: none;
			outline: none;
			background: transparent;
			padding: 3px 5px;
			line-height: 1.45;
			@include text-style(1, 400, 1.35rem);
		}
		&__field::placeholder {
			opacity: 0.42;
		}
		&__actions {
			display: flex;
			align-items: center;
			flex-shrink: 0;
		}
		&__submit {
			@include flex(center, center);
			flex-shrink: 0;
			width: 32px;
			height: 32px;
			border-radius: 12px;
			position: relative;
			border: none;
			cursor: pointer;
			background-color: rgba(var(--textColor1), 0.04);
			transition: all 0.08s ease-in-out;

			&:hover {
				background-color: rgba(var(--textColor1), 0.11);
			}
			&:active {
				transform: scale(0.96);
			}
			&:focus-visible {
				@include border-focus;
			}
			&:disabled {
				opacity: 0.28;
				cursor: not-allowed;
				transform: none;
			}

			&--active {
				background-color: rgba(var(--textColor1), 0.06);

				&:hover {
					background-color: rgba(var(--textColor1), 0.12);
				}
			}
			&--jitter {
				animation: link-menu-submit-jitter 0.32s ease;
			}
			span {
				position: absolute;
				top: calc(50% - 2px);
				left: 50%;
				transform: translate(-50%, -50%);
				@include text-style(1, 300, 1.75rem);
			}
		}
		&__reset {
			@include text-style(1, 300, 1.75rem);
			margin: -2px 10px 0px 0px;
			opacity: 0.14;
			border: none;
			background: none;
			cursor: pointer;
			padding: 0;
			line-height: 1;

			&:hover {
				opacity: 0.6;
			}
		}

		@keyframes link-menu-submit-jitter {
			0%,
			100% {
				transform: translateX(0);
			}
			20% {
				transform: translateX(-2px);
			}
			40% {
				transform: translateX(2px);
			}
			60% {
				transform: translateX(-1px);
			}
			80% {
				transform: translateX(1px);
			}
		}
	}
</style>
