type Handlers = {
	input?: (args: { val: string; length: number; event: Event }) => void
	focus?: (e: FocusEvent) => void
	blur?: (args: { val: string; length: number; event: FocusEvent }) => void
	keydown?: (e: KeyboardEvent) => void
	keyup?: (e: KeyboardEvent) => void
	keypress?: (e: KeyboardEvent) => void
	paste?: (e: ClipboardEvent) => void
	onDebounce?: (val: string) => void
}

const TEXT_SAVE_DELAY_MS = 1000

export default class Editable {
	text?: string | null
	placeholder: string
	id: string
	max: number
	allowNewLine: boolean
	disabled: boolean
	addDefaultText: boolean
	allowFormat: boolean

	value = ''
	length = 0

	elem: HTMLDivElement | null = null
	handlers?: Handlers

	debounceTimeout: number | null = null

	private boundBlurHandler = this.onBlurHandler.bind(this)
	private boundInputHandler = this.onInputHandler.bind(this)
	private boundKeyDownHandler = this.onKeyDownHandler.bind(this)
	private boundPasteHandler = this.onPasteHandler.bind(this)
	private boundFocusHandler = this.onFocusHandler.bind(this)

	constructor({
		text,
		placeholder,
		id,
		handlers,
		max = 500,
		allowNewLine = true,
		disabled = false,
		addDefaultText = false,
		allowFormat = false
	}: {
		text?: string | null
		placeholder: string
		id: string
		handlers?: Handlers
		max?: number
		allowNewLine?: boolean
		disabled?: boolean
		addDefaultText?: boolean
		allowFormat?: boolean
	}) {
		this.text = text
		this.placeholder = placeholder
		this.id = id
		this.allowFormat = allowFormat
		this.max = max
		this.handlers = handlers
		this.allowNewLine = allowNewLine
		this.disabled = disabled
		this.addDefaultText = addDefaultText

		this.init()
	}

	setText(text: string) {
		if (!this.elem) return

		this.elem.textContent = text
		this.length = text.length
		this.value = text
		this.elem.normalize()

		this.handlers?.input?.({
			val: text,
			length: this.length,
			event: new Event('input')
		})
	}

	focus() {
		this.elem?.focus()
	}

	toggleDisable(disable?: boolean) {
		this.disabled = disable != undefined ? disable : !this.disabled
	}

	blur() {
		this.elem?.blur()
	}

	getText(target: HTMLElement): string {
		if (this.allowFormat) {
			return target.innerHTML
		}
		return target.textContent || ''
	}

	onInputHandler(e: Event) {
		const ie = e as InputEvent
		const target = e.target as HTMLElement
		const rawText = target.innerHTML
		const content = target.textContent || ''

		if (ie.inputType === 'insertFromPaste') {
			this.setCursorPos(target, this.length)
			return
		}
		if (content.length > this.max) {
			target.textContent = this.value
			this.setCursorPos(target, this.value.length)
			return
		}
		if (rawText === '<br>') {
			target.innerHTML = ''
			target.innerText = ''
		}

		this.length = content.length
		this.value = this.getText(target)
		this.elem!.normalize()

		this.handlers?.input?.({
			val: content,
			length: this.length,
			event: e
		})
		if (this.handlers?.onDebounce) {
			this.debounceHandler()
		}
	}

	onBlurHandler(e: FocusEvent) {
		if (this.value.trim() === '' && this.addDefaultText) {
			this.setText('Untitled')
		}

		const target = e.target as HTMLElement
		const val = this.getText(target)
		const length = val.length

		this.value = val
		this.length = length

		this.handlers?.blur?.({
			val,
			length,
			event: e
		})
	}

	onFocusHandler(e: FocusEvent) {
		this.handlers?.focus?.(e)
	}

	onKeyDownHandler(ke: KeyboardEvent) {
		if (this.disabled) {
			ke.preventDefault()
			return
		}
		const { key, shiftKey } = ke
		const newLine = key === 'Enter' && shiftKey

		if (newLine) {
			ke.preventDefault()
		} else if (key === 'Enter') {
			this.elem!.blur()
		}

		this.handlers?.keydown?.(ke)
	}

	debounceHandler() {
		this.unsetDebounce()

		this.debounceTimeout = setTimeout(() => {
			this.handlers?.onDebounce?.(this.value)
			this.unsetDebounce()
		}, TEXT_SAVE_DELAY_MS) as unknown as number
	}

	unsetDebounce() {
		if (!this.debounceTimeout) return
		clearTimeout(this.debounceTimeout)
		this.debounceTimeout = null
	}

	onPasteHandler(e: ClipboardEvent) {
		e.preventDefault()
		if (!this.elem) return

		const plainText = e.clipboardData?.getData('text/plain') || ''

		if (!plainText || plainText.length + this.length > this.max) {
			return
		}

		const selection = window.getSelection()
		let pasteStartPos = this.elem.textContent?.length || 0

		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0)
			const rangeClone = range.cloneRange()
			rangeClone.selectNodeContents(this.elem)
			rangeClone.setEnd(range.startContainer, range.startOffset)
			pasteStartPos = rangeClone.toString().length

			range.deleteContents()

			const node = document.createTextNode(plainText)
			range.insertNode(node)
		} else {
			this.elem.textContent = (this.elem.textContent || '') + plainText
			pasteStartPos = this.elem.textContent.length - plainText.length
		}

		this.length = this.elem.textContent?.length || 0
		this.value = this.getText(this.elem)
		this.elem.normalize()

		const cPos = pasteStartPos + plainText.length
		this.setCursorPos(this.elem, cPos)

		this.handlers?.input?.({
			val: this.value,
			length: this.length,
			event: e
		})
	}

	setCursorPos(element: HTMLElement, pos: number) {
		const selection = window.getSelection()
		const range = document.createRange()

		if (!selection || !element.firstChild) return

		if (pos > element.textContent!.length) {
			pos = element.textContent!.length
		}

		range.setStart(element.firstChild, pos)
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	init() {
		this.elem = document.getElementById(this.id) as HTMLDivElement | null
		if (!this.elem) return

		this.value = this.getText(this.elem)

		this.elem.addEventListener('blur', this.boundBlurHandler)
		this.elem.addEventListener('input', this.boundInputHandler)
		this.elem.addEventListener('keydown', this.boundKeyDownHandler)
		this.elem.addEventListener('paste', this.boundPasteHandler)
		this.elem.addEventListener('focus', this.boundFocusHandler)
		this.elem.spellcheck = false

		if (this.handlers?.keyup) {
			this.elem.addEventListener('keyup', this.handlers.keyup)
		}
		if (this.handlers?.keypress) {
			this.elem.addEventListener('keypress', this.handlers.keypress)
		}
		this.elem.setAttribute('data-placeholder', this.placeholder)
	}

	quit() {
		if (!this.elem) return
		this.elem.removeEventListener('blur', this.boundBlurHandler)
		this.elem.removeEventListener('input', this.boundInputHandler)
		this.elem.removeEventListener('keydown', this.boundKeyDownHandler)
		this.elem.removeEventListener('paste', this.boundPasteHandler)
		this.elem.removeEventListener('focus', this.boundFocusHandler)

		if (this.handlers?.keyup) {
			this.elem.removeEventListener('keyup', this.handlers.keyup)
		}
		if (this.handlers?.keypress) {
			this.elem.removeEventListener('keypress', this.handlers.keypress)
		}
	}
}
