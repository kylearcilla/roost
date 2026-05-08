<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte'

	type Props = {
		context?: 'big' | 'small'
		loading?: boolean
	}

	let { context = 'small', loading = false }: Props = $props()
</script>

<div
	class="upload-icon"
	class:upload-icon--big={context === 'big'}
	class:upload-icon--loading={loading}
>
	<svg
		class="upload-icon__svg"
		width="152"
		height="202"
		viewBox="0 0 152 202"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M0 25.2273C0 11.3129 11.3129 0 25.2273 0H88.2955V50.4546C88.2955 57.4315 93.9322 63.0682 100.909 63.0682H151.364V176.591C151.364 190.505 140.051 201.818 126.136 201.818H25.2273C11.3129 201.818 0 190.505 0 176.591V25.2273ZM151.364 50.4546H100.909V0L151.364 50.4546Z"
			fill="black"
		/>
		{#if !loading}
			<g class="upload-icon__arrow">
				<path
					d="M75.6838 151.531C74.2048 151.531 72.7259 150.922 71.7254 149.921L49.7155 127.824C48.628 126.693 48.0626 125.388 48.0626 124.127C48.0626 120.995 50.2375 118.864 53.1083 118.864C54.6742 118.864 55.9357 119.56 56.8926 120.56L63.8523 127.476L70.7685 135.045L70.3335 127.607V90.4161C70.3335 87.1102 72.5084 84.8918 75.6838 84.8918C78.8591 84.8918 80.9905 87.1102 80.9905 90.4161V127.607L80.5555 135.045L87.4717 127.476L94.4314 120.56C95.4318 119.56 96.6498 118.864 98.2592 118.864C101.13 118.864 103.305 120.995 103.305 124.127C103.305 125.388 102.739 126.693 101.609 127.824L79.5986 149.921C78.5981 150.922 77.1192 151.531 75.6838 151.531Z"
					fill="#F5F5F5"
				/>
			</g>
		{/if}
	</svg>
	{#if loading}
		<div class="upload-icon__spinner" aria-busy="true" aria-live="polite">
			<Spinner scale={1.2} bg="#F5F5F5" />
		</div>
	{/if}
</div>

<style lang="scss">
	.upload-icon {
		position: relative;
		width: 14px;
		height: 14px;
		object-fit: contain;
		opacity: 0.2;
		display: block;
		flex-shrink: 0;

		&--loading {
			opacity: 1;
		}

		&--big {
			width: 100%;
			height: 100%;
			opacity: 1;
		}

		&__svg {
			display: block;
			width: 100%;
			height: 100%;
		}

		&__spinner {
			position: absolute;
			left: 50%;
			top: 62%;
			transform: translate(-50%, -50%);
			pointer-events: none;
			line-height: 0;
		}

		&--big &__spinner {
			top: 58%;
		}

		&--big &__arrow {
			transform-box: fill-box;
			transform-origin: 50% 45%;
			animation: upload-icon-arrow-bob 1s ease-in-out infinite;
		}
	}

	@keyframes upload-icon-arrow-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-20%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.upload-icon--big .upload-icon__arrow {
			animation: none;
		}
	}
</style>
