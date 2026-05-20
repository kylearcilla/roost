import type { Component } from 'svelte'
import { cursorPos } from '$lib/float/cursor.svelte'
import { initFloatElemPos } from '$lib/float/layout'
type ComponentType = Component

export type AbsFloatInitArgs = {
	component?: ComponentType
	items?: DropdownItem[]
	text?: TextInputProps
	chosenText?: string
	onOptnClick?: (label: string, id?: string) => void
	offset?: { top: number; left: number }
	dims?: { height?: number; width?: number }
	props?: Record<string, unknown>
	id: string
	onClose?: () => void
	/** Frosted dropdown panel (e.g. card context menus) */
	menuGlass?: boolean
}

type AbsoluteFloatElem = {
	id: string
	dmenuId: string
	bounceId: string
	isHidden: boolean
	props: Record<string, unknown>
	component?: ComponentType
	items?: DropdownItem[]
	chosenText?: string
	text?: TextInputProps
	dims?: { height?: number; width?: number }
	onOptnClick?: (label: string, id?: string) => void
	position: { top: number; left: number }
	onClose?: () => void
	menuGlass?: boolean
}

function AbsoluteFloatElem() {
	let state = $state<AbsoluteFloatElem[]>([])

	function init({
		id,
		dims,
		component,
		items,
		text,
		chosenText,
		onOptnClick,
		props,
		offset = { top: 15, left: -35 },
		onClose,
		menuGlass
	}: AbsFloatInitArgs) {
		let position = { top: 0, left: 0 }

		if (text) {
			dims = { width: 450 }
			onClose = text.onClose
			if (text.offset) offset = text.offset
		}
		if (dims) {
			position = getPopFloatElemPos({
				height: dims.height ?? 0,
				width: dims.width ?? 250
			})
		} else {
			position = {
				top: cursorPos.top,
				left: cursorPos.left
			}
		}
		if (offset) {
			position.left += offset.left
			position.top += offset.top
		}
		state = [
			...state.filter((e) => e.id !== id),
			{
				props: props || {},
				position,
				component,
				items,
				text,
				dims,
				chosenText,
				onOptnClick,
				dmenuId: id,
				id,
				bounceId: id,
				onClose,
				menuGlass: menuGlass ?? false,
				isHidden: false
			}
		]
	}

	function close(id?: string) {
		const targetId = id || state[state.length - 1]?.id
		state = state.map((e) => (e.id === targetId ? { ...e, isHidden: true } : e))
		const elem = state.find((e) => e.id === targetId)

		if (elem?.onClose) {
			elem.onClose()
		}
	}

	function onDismount(id: string) {
		state = state.filter((elem) => elem.id !== id)
	}

	const absFn = function (args: AbsFloatInitArgs) {
		return init(args)
	} as typeof init & {
		init: typeof init
		close: typeof close
		onDismount: typeof onDismount
		state: AbsoluteFloatElem[]
	}

	absFn.init = init
	absFn.close = close
	absFn.onDismount = onDismount

	Object.defineProperty(absFn, 'state', {
		get: () => state,
		enumerable: true,
		configurable: true
	})

	return absFn
}

export const abs = AbsoluteFloatElem()

export function getPopFloatElemPos(box: { height: number; width: number }) {
	const { height, width } = box

	const fromPos = {
		top: cursorPos.top,
		left: cursorPos.left
	}
	return initFloatElemPos({
		dims: {
			height,
			width
		},
		cursorPos: fromPos,
		margins: { ns: 8, ew: 8 }
	})
}
