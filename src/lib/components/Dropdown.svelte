<script lang="ts">
	import '../../scss/dropdown.scss'
	import ToggleBtn from './ToggleBtn.svelte'

	let {
		items,
		chosenText,
		width,
		glass = false,
		onOptnClick
	}: {
		items: DropdownItem[]
		chosenText?: string
		width?: number
		glass?: boolean
		onOptnClick?: (label: string, id?: string) => void
	} = $props()
</script>

<ul
	class="dmenu"
	class:dmenu--glass={glass}
	style:width={!width ? 'auto' : `${width}px`}
	style:min-width="80px"
>
	{#each items as item}
		{#if item && item.if !== false}
			{#if item.type === 'section'}
				<li class="dmenu__section-name" style:margin={item.margin || undefined}>{item.name}</li>
			{:else if item.type === 'divider'}
				<li class="dmenu__section-divider" style:margin={item.margin || undefined}></li>
			{:else if item.type === 'context'}
				<li class="dmenu__context" style:margin={item.margin || undefined}>
					<span>{item.text}</span>
				</li>
			{:else if item.type === 'btn'}
				{@const buttonStyle = [item.margin ? `margin: ${item.margin}` : '', item.style || '']
					.filter(Boolean)
					.join('; ')}
				<li
					class="dmenu__option"
					style={buttonStyle || undefined}
					class:dmenu__option--selected={chosenText === item.label}
				>
					<button
						type="button"
						aria-label={item.ariaLabel || item.label}
						class="dmenu__option-btn"
						onclick={() => onOptnClick?.(item.label, item.id)}
						disabled={item.disabled}
						style:padding-right={item.paddingRight || ''}
					>
						<span class="dmenu__option-text">{item.label}</span>
						{#if chosenText === item.label}
							<svg
								style:opacity="0.4"
								style:transform="scale(1.15)"
								width="10"
								height="7"
								viewBox="0 0 10 7"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M8.88882 0.186252C9.14222 0.434588 9.14222 0.837886 8.88882 1.08622L3.6991 6.17215C3.44569 6.42048 3.03417 6.42048 2.78076 6.17215L0.185903 3.62918C-0.0675014 3.38085 -0.0675014 2.97755 0.185903 2.72921C0.439307 2.48088 0.850835 2.48088 1.10424 2.72921L3.24094 4.8212L7.97251 0.186252C8.22591 -0.062084 8.63744 -0.062084 8.89084 0.186252H8.88882Z"
									fill="black"
								/>
							</svg>
						{/if}
					</button>
				</li>
			{:else if item.type === 'toggle'}
				<li class="dmenu__option">
					<div class="dmenu__toggle-optn">
						<span class="dmenu__option-text" style:margin-right="12px">{item.label}</span>
						<ToggleBtn
							active={item.active}
							onToggle={() => {
								item.active = !item.active
								item.onToggle()
							}}
						/>
					</div>
				</li>
			{/if}
		{/if}
	{/each}
</ul>
