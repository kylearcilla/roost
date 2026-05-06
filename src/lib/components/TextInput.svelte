<script lang="ts">
	import Editable from '$lib/Editable'
	import { onMount } from 'svelte'

	let {
		title = 'New Text',
		placeholder = 'Start Typing...',
		value,
		initialValue,
		onChange,
		onSubmit
	}: {
		title?: string
		placeholder?: string
		value?: string
		initialValue?: string
		onChange?: (value: string) => void
		onSubmit: (value: string) => void | Promise<void>
	} = $props()

	const INPUT_ID = 'text-input'

	let text = $state('')
	let editable: Editable | null = null
	let loading = $state(false)
	let ref: HTMLDivElement | null = $state(null)

	$effect(() => {
		text = (value ?? initialValue) ?? ''
	})

	function initEditable() {
		if (editable) {
			editable.quit()
			editable = null
		}
		editable = new Editable({
			text,
			placeholder,
			id: INPUT_ID,
			handlers: {
				input: ({ val }) => {
					onChange?.(val)
					text = val
				}
			}
		})
	}

	function handleSubmit() {
		if (!text.trim() || loading) return
		loading = true
		void Promise.resolve(onSubmit(text)).finally(() => {
			loading = false
		})
	}

	$effect(() => {
		requestAnimationFrame(() => initEditable())
		return () => {
			if (editable) {
				editable.quit()
				editable = null
			}
		}
	})

	$effect(() => {
		if (editable && text !== editable.value) {
			editable.setText(text)
			editable.focus()
		}
	})

	onMount(() => setTimeout(() => ref?.focus(), 200))
</script>

<div class="text-input-wrapper">
	<h2 class="text-input-wrapper__title">{title}</h2>
	<div
		id={INPUT_ID}
		class="text-input"
		contenteditable="true"
		spellcheck="false"
		bind:this={ref}
		bind:textContent={text}
	></div>
	<button
		type="button"
		class="text-input-wrapper__submit-btn"
		onclick={handleSubmit}
		disabled={loading || !text.trim()}
	>
		<span>Submit →</span>
	</button>
</div>

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.text-input-wrapper {
		padding: 12px 17px 13px 15px;
		width: 320px;
		position: relative;
		border-radius: 12px;
		box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 0.1);
		z-index: 2000;
		background-color: #fffdf9;

		&__title {
			@include text-style(0.25, 400, 1.2rem);
		}

		&__submit-btn {
			display: flex;
			align-items: center;
			background: #f2fd5c;
			border-radius: 8px;
			padding: 10px 18px;
			border: none;
			cursor: pointer;
			@include text-style(1, 400, 1.2rem);
			transition: all 0.2s ease;
			margin-left: auto;

			&:hover:not(:disabled) {
				opacity: 1;
			}

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
	}

	.text-input {
		background: rgba(0, 0, 0, 0.03);
		margin: 12px 0px 7px 0px;
		border-radius: 8px;
		padding: 8px 8px 10px 12px;
		@include text-style(1, 400, 1.2rem);
		transition: all 0.2s ease;
		word-wrap: break-word;
		white-space: pre-wrap;
		line-height: 1.35;
		border: 1px dashed rgba(209, 204, 199, 0);

		&:empty::before {
			content: attr(data-placeholder);
			opacity: 0.2;
			pointer-events: none;
		}

		&:focus {
			border: 1px dashed rgba(209, 204, 199, 0.85);
		}
	}
</style>
