<script lang="ts">
	import BounceFade from '$lib/components/BounceFade.svelte'
	import Dropdown from '$lib/components/Dropdown.svelte'
	import TextInput from '$lib/components/TextInput.svelte'
	import { abs } from '$lib/AbsFloatElem.svelte'

	const { close, onDismount } = abs
	const floatElems = $derived(abs.state)
</script>

{#each floatElems as floatElem (floatElem.id)}
	<BounceFade
		dmenuId={floatElem.dmenuId}
		zIndex={20000}
		isHidden={floatElem.isHidden}
		onClickOutside={() => {
			close(floatElem.id)
		}}
		onDismount={() => {
			onDismount(floatElem.bounceId)
		}}
		position={{
			top: floatElem.position.top - 5,
			left: floatElem.position.left - 5
		}}
	>
		{#if floatElem.items}
			<Dropdown
				items={floatElem.items}
				chosenText={floatElem.chosenText}
				width={floatElem.dims?.width}
				glass={floatElem.menuGlass}
				onOptnClick={floatElem.onOptnClick}
			/>
		{:else if floatElem.text}
			<TextInput
				title={floatElem.text.title}
				placeholder={floatElem.text.placeholder}
				initialValue={floatElem.text.value ?? ''}
				onChange={floatElem.text.onChange}
				onSubmit={async (value) => {
					await floatElem.text?.onSubmit?.(value)
					close(floatElem.id)
				}}
			/>
		{:else if floatElem.component}
			{@const Component = floatElem.component}
			<Component {...floatElem.props} />
		{/if}
	</BounceFade>
{/each}
