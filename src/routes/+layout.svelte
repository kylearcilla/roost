<script lang="ts">
	import '../scss/app.scss'

	import AbsFloatElem from '$lib/components/AbsFloatElem.svelte'
	import { cursorPos } from '$lib/float/cursor.svelte'
	import favicon from '$lib/assets/favicon.svg'

	let { children } = $props()

	function onPointerMove(e: PointerEvent) {
		cursorPos.top = e.clientY
		cursorPos.left = e.clientX
	}
</script>

<svelte:window on:pointermove={onPointerMove} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}

<AbsFloatElem />
