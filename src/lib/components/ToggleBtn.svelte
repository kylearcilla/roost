<script lang="ts">
	let {
		active = false,
		onToggle
	}: {
		active: boolean
		onToggle: () => void
	} = $props()
</script>

<button
	type="button"
	aria-label="Toggle"
	class="toggle"
	class:toggle--active={active}
	onclick={onToggle}
>
	<div class="toggle__circle smooth-bounce"></div>
</button>

<style lang="scss">
	@use '../../scss/mixins.scss' as *;

	.toggle {
		background-color: rgba(var(--textColor1), 0.06);
		height: 18px;
		width: 30px;
		border-radius: 20px;
		position: relative;
		opacity: 1 !important;
		border: none;
		cursor: pointer;
		padding: 0;

		&--active {
			background-color: #FFEC77;
		}
		&--active &__circle {
			left: calc(100% - (12px + 3.5px));
		}
		&__circle {
			@include circle(13.5px);
			position: absolute;
			top: 2.5px;
			left: 2.5px;
			background-color: white;
		}
	}
</style>
