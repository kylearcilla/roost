/** Reactive box from `+layout.svelte` for macOS inset title-bar chrome. */
export const ELECTRON_CHROME_INSET_CTX = Symbol.for('roost.electronChromeInset')

export type ElectronChromeInsetBox = {
	active: boolean
}
