<script lang="ts">
	import { abs, cursorPos } from '$lib'
	import FloatInput from '$lib/components/FloatInput.svelte'
	import Modal from '$lib/components/Modal.svelte'
	import { extractUrl } from '$lib/lib/collection-sources'
	import { DEFAULT_IMG_UPLOAD_CONSTRAINTS, validateImgURL } from '$lib/lib/fetch-content'
	import { persistVolatileImageHref, saveImportedUserFile, storedImageSrc } from '$lib/lib/importedMedia'
	import { browser } from '$app/environment'
	import { global } from '$lib/lib/global.svelte'

	type Props = {
		open: boolean
		onClose: () => void
	}
	let { open, onClose }: Props = $props()

	const SETTINGS_AVATAR_IMG_FLOAT_ID = 'settings-avatar-img-float'
	const storageSize = '28 MB'

	const dataRootPath = $derived.by(() => {
		if (!browser) return ''
		const p = window.roost?.userDataPath?.trim()
		return p ?? ''
	})

	async function revealDataFolder() {
		if (!dataRootPath || !window.electronAPI?.revealUserDataInFileManager) return
		await window.electronAPI.revealUserDataInFileManager()
	}
	const AVATAR_MENU_ID = 'settings-avatar-menu'

	const avatarMenuItems: DropdownItem[] = [
		{ type: 'btn', label: 'New image', id: 'replace' },
		{ type: 'divider' },
		{ type: 'btn', label: 'Remove image', id: 'remove' }
	]

	let avatarUrl = $state<string | undefined>(global.user?.avatarUrl)
	let avatarFileInputEl = $state<HTMLInputElement | null>(null)
	let nameDraft = $state(global.user?.displayName ?? '')
	let isNameFocused = $state(false)

	let avatarImgFloatHidden = $state(true)
	let avatarImgLinkDraft = $state('')
	let avatarImgSubmitJitter = $state(false)
	let avatarImgSubmitShowArrow = $state(false)
	let avatarImgSubmitValidating = $state(false)

	$effect(() => {
		if (!open) return
		avatarUrl = global.user?.avatarUrl
		nameDraft = global.user?.displayName ?? ''
	})

	$effect(() => {
		if (open) return
		avatarImgFloatHidden = true
		avatarImgLinkDraft = ''
		avatarImgSubmitShowArrow = false
	})

	$effect(() => {
		if (avatarImgFloatHidden) return
		if (avatarImgLinkDraft.trim() !== '') return
		avatarImgSubmitShowArrow = false
	})

	async function commitName() {
		isNameFocused = false
		const next = nameDraft.trim()
		if (!global.user) await global.fetchUser()
		await global.updateUser({ displayName: next })
		nameDraft = next
	}

	function onExportData() {
		// placeholder: wire export when persistence exists
	}
	function onAvatarContextMenu(e: MouseEvent) {
		if (!avatarUrl) {
			e.preventDefault()
			cursorPos.top = e.clientY
			cursorPos.left = e.clientX
			openAvatarImgFloat()
			return
		}
		e.preventDefault()
		e.stopPropagation()
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		abs({
			id: AVATAR_MENU_ID,
			items: avatarMenuItems,
			dims: { width: 130 },
			offset: { top: 0, left: 0 },
			onOptnClick: (_label, id) => {
				abs.close(AVATAR_MENU_ID)
				if (id === 'replace') openAvatarImgFloat()
				if (id === 'remove') {
					avatarUrl = undefined
					global.updateUser({ avatarUrl: undefined })
				}
			}
		})
	}

	function closeAvatarImgFloat() {
		avatarImgFloatHidden = true
		avatarImgLinkDraft = ''
		avatarImgSubmitShowArrow = false
	}

	function openAvatarImgFloat() {
		avatarImgLinkDraft = ''
		avatarImgSubmitShowArrow = false
		avatarImgFloatHidden = false
	}

	function openAvatarImgFilePicker() {
		avatarFileInputEl?.click()
	}

	function triggerAvatarImgJitter() {
		avatarImgSubmitJitter = true
		window.setTimeout(() => (avatarImgSubmitJitter = false), 320)
	}

	async function applyAvatarStored(stored: string) {
		avatarUrl = stored
		if (!global.user) await global.fetchUser()
		void global.updateUser({ avatarUrl: stored })
	}

	async function applyAvatarHref(href: string) {
		if (href.startsWith('blob:') || href.startsWith('data:')) {
			const r = await persistVolatileImageHref(href, { scope: 'user' })
			await applyAvatarStored('path' in r ? r.path : r.url)
			return
		}
		await applyAvatarStored(href)
	}

	async function submitAvatarImgFloat() {
		const raw = avatarImgLinkDraft.trim()
		if (!raw) return
		const extracted = extractUrl(avatarImgLinkDraft)
		if (!extracted) {
			if (raw) triggerAvatarImgJitter()
			avatarImgSubmitShowArrow = false
			return
		}
		if (!avatarImgSubmitShowArrow) {
			avatarImgSubmitShowArrow = true
			return
		}
		const again = extractUrl(avatarImgLinkDraft)
		if (!again) {
			triggerAvatarImgJitter()
			avatarImgSubmitShowArrow = false
			return
		}
		const href = again.href
		if (href.startsWith('blob:') || href.startsWith('data:')) {
			await applyAvatarHref(href)
			closeAvatarImgFloat()
			return
		}
		avatarImgSubmitValidating = true
		try {
			await validateImgURL({ url: href, constraints: DEFAULT_IMG_UPLOAD_CONSTRAINTS })
			await applyAvatarHref(href)
			closeAvatarImgFloat()
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return
			triggerAvatarImgJitter()
			avatarImgSubmitShowArrow = false
		} finally {
			avatarImgSubmitValidating = false
		}
	}

	function onSkeletonClick(e: MouseEvent) {
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
		openAvatarImgFloat()
	}

	function onAvatarImgFilePicked(e: Event) {
		const el = e.currentTarget as HTMLInputElement
		const file = el.files?.[0]
		el.value = ''
		if (!file || !file.type.startsWith('image/')) return
		void (async () => {
			const saved = await saveImportedUserFile(file, { scope: 'user' })
			if (saved.ok) await applyAvatarStored(saved.absolutePath)
			else await applyAvatarHref(URL.createObjectURL(file))
			closeAvatarImgFloat()
		})()
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return
		if (avatarImgFloatHidden) return
		e.preventDefault()
		closeAvatarImgFloat()
	}}
/>

{#if open}
	<Modal
		fitContent
		options={{
			flat: true,
			scaleUp: true,
			borderRadius: '28px',
			overflowX: 'hidden',
			overflowY: 'hidden',
			height: 'auto',
			opacity: '0.4'
		}}
		onClickOutSide={() => onClose()}
	>
		{#snippet children()}
			<div class="settings">
				<div class="settings__row">
					<div class="settings__left">
						<div
							class="settings__avatar-wrap"
							role="group"
							aria-label="Profile image"
							oncontextmenu={onAvatarContextMenu}
						>
							{#if avatarUrl}
								<div class="settings__avatar">
									<img src={storedImageSrc(avatarUrl)} alt="" draggable="false" />
								</div>
							{:else}
								<button
									type="button"
									class="settings__avatar-skeleton"
									aria-label="Add profile image"
									onclick={(e) => onSkeletonClick(e)}
								>
									<svg
										class="settings__avatar-placeholder-svg"
										viewBox="0 0 512 448"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
										aria-hidden="true"
									>
										<path
											d="M0 64C0 28.7 28.7 0 64 0H448C483.3 0 512 28.7 512 64V384C512 419.3 483.3 448 448 448H64C28.7 448 0 419.3 0 384V64ZM323.8 170.5C319.3 163.9 311.9 160 304 160C296.1 160 288.6 163.9 284.2 170.5L197.2 298.1L170.7 265C166.1 259.3 159.2 256 152 256C144.8 256 137.8 259.3 133.3 265L69.3 345C63.5 352.2 62.4 362.1 66.4 370.4C70.4 378.7 78.8 384 88 384H184H216H424C432.9 384 441.1 379.1 445.2 371.2C449.3 363.3 448.8 353.8 443.8 346.5L323.8 170.5ZM112 160C124.73 160 136.939 154.943 145.941 145.941C154.943 136.939 160 124.73 160 112C160 99.2696 154.943 87.0606 145.941 78.0589C136.939 69.0571 124.73 64 112 64C99.2696 64 87.0606 69.0571 78.0589 78.0589C69.0571 87.0606 64 99.2696 64 112C64 124.73 69.0571 136.939 78.0589 145.941C87.0606 154.943 99.2696 160 112 160Z"
											fill="currentColor"
										/>
									</svg>
								</button>
							{/if}
						</div>
					</div>
					<div class="settings__right">
						<div class="settings__field">
							<label class="settings__label" for="settings-display-name">Name</label>
							<div class="settings__box" class:settings__box--focus={isNameFocused}>
								<input
									id="settings-display-name"
									type="text"
									class="settings__name-input"
									autocomplete="name"
									spellcheck="false"
									placeholder="Enter your name"
									bind:value={nameDraft}
                                    onfocus={() => isNameFocused = true}
									onblur={() => void commitName()}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											;(e.currentTarget as HTMLInputElement).blur()
										}
									}}
								/>
							</div>
						</div>
						<div class="settings__field">
							<span class="settings__label">Storage Location</span>
							<div class="settings__storage" style:margin-top="5px">
								<button
									type="button"
									class="settings__path"
									title={dataRootPath ? `${dataRootPath} — show in file manager` : ''}
									disabled={!dataRootPath}
									onclick={() => void revealDataFolder()}
								>
									{dataRootPath || '—'}
								</button>
                                
								<span class="settings__size">{storageSize}</span>
							</div>
						</div>
					</div>
				</div>
				<button type="button" class="settings__export" onclick={onExportData}>
					Export Data
				</button>
				<input
					type="file"
					accept="image/*"
					class="settings__file"
					aria-hidden="true"
					tabindex="-1"
					bind:this={avatarFileInputEl}
					onchange={onAvatarImgFilePicked}
				/>
			</div>
		{/snippet}
	</Modal>
{/if}

<FloatInput
	dmenuId={SETTINGS_AVATAR_IMG_FLOAT_ID}
	bind:hidden={avatarImgFloatHidden}
	bind:value={avatarImgLinkDraft}
	inputType="imgUrl"
	placeholder="Paste or type image URL…"
	onClose={closeAvatarImgFloat}
	onPress={submitAvatarImgFloat}
	submitReady={Boolean(avatarImgSubmitShowArrow && extractUrl(avatarImgLinkDraft))}
	submitJitter={avatarImgSubmitJitter}
	onImgUpload={openAvatarImgFilePicker}
	isDisabled={avatarImgSubmitValidating}
/>

<style lang="scss">
	@use '../scss/mixins.scss' as *;

	.settings {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 560px;
		min-height: 370px;
		padding: 20px 24px 24px 20px;
		box-sizing: border-box;
		border-radius: 0;
		border: none;
		box-shadow: none;
		gap: 120px;

		--img-percentage: 45%;
		--padding: 28px;

		&__file {
			position: absolute;
			width: 0;
			height: 0;
			opacity: 0;
			pointer-events: none;
		}
		&__row {
			display: flex;
			flex-direction: row;
			align-items: flex-start;
			gap: var(--padding);
			flex: 1 1 auto;
			min-height: 0;
			width: 100%;
		}
		&__left {
			width: var(--img-percentage);
			display: flex;
			flex-direction: column;
			align-items: stretch;
			min-width: 0;
		}
		&__avatar-wrap {
			position: relative;
			width: 100%;
			aspect-ratio: 1;
		}
		&__avatar {
			overflow: hidden;
			width: 100%;
			height: 100%;
			border: none;
			box-shadow: none;
			border-radius: 18px;

			img {
				display: block;
				width: 100%;
				height: 100%;
				object-fit: cover;
			}
		}
		&__avatar-skeleton {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			margin: 0;
			border: none;
			cursor: pointer;
			border-radius: 18px;
			background: rgba(var(--textColor1), 0.04);
			color: rgba(var(--textColor1), 0.08);
            transition: background 0.1s ease;

            svg {
                width: 60px;
            }
            &:hover {
                background: rgba(var(--textColor1), 0.06);
            }
		}
		&__avatar-placeholder-svg {
			display: block;
			width: 150px;
			height: auto;
			flex-shrink: 0;
		}
		&__right {
			width: 60%;
			display: flex;
			flex-direction: column;
			gap: 20px;
			min-width: 0;
		}
		&__field {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		&__label {
			@include text-style(0.45, 500, 1.15rem);
		}

		&__box {
			@include text-style(1, 400, 1.3rem);
			background: rgba(var(--textColor1), 0.04);
			border-radius: 10px;
			padding: 12px 14px 13px 14px;
			margin-left: -5px;
			border: none;
			box-shadow: none;
            transition: box-shadow 0.3s ease-in-out;

            &--focus {
                box-shadow: rgba(var(--textColor1), 0.085) 0px 0px 0px 2px inset, 
                            rgba(var(--textColor1), 0.05) 0px 0px 0px 2.5px;
            }
		}

		&__name-input {
			display: block;
			width: 100%;
			margin: 0;
			padding: 0;
			border: none;
			background: transparent;
			font: inherit;
			font-size: inherit;
			font-weight: inherit;
			line-height: inherit;
			color: inherit;
			outline: none;
			box-sizing: border-box;
		}

		&__storage {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 16px;
			min-width: 0;
		}
		&__path {
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
			@include text-style(0.82, 450, 1.12rem);
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			cursor: pointer;
			&:disabled {
				cursor: default;
				opacity: 0.5;
			}
            &:hover:not(:disabled) {
                text-decoration: underline;
            }
		}
		&__size {
			flex-shrink: 0;
			@include text-style(0.4, 400, 1.25rem);
			display: none;
		}
		&__export {
			margin-top: auto;
			align-self: flex-start;
			border: none;
			box-shadow: none;
			background: none;
			padding: 0;
			cursor: pointer;
			font: inherit;
			text-align: left;
			@include text-style(1, 400, 1.25rem);
			opacity: 0.35;

			&:hover {
				opacity: 0.8;
				text-decoration: underline;
			}
		}
	}
</style>
