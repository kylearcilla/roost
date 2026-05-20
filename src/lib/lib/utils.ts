export const COL_SIZES = {
  icon: 40,
  small: 140,
  medium: 185,
  large: 230,
  xlarge: 275,
  full: 370,
}

/** Slider / `GridColumnSize` step order (matches `COL_SIZES` keys). */
export const GRID_COLUMN_SIZE_ORDER = ['icon', 'small', 'medium', 'large', 'xlarge', 'full'] as const

/** Masonry column widths per WidthSlider step (small → xlarge). */
export const GRID_COLUMN_WIDTHS = [
  COL_SIZES.icon,
  COL_SIZES.small,
  COL_SIZES.medium,
  COL_SIZES.large,
  COL_SIZES.xlarge,
  COL_SIZES.full
] as const

export function gridColumnSizeAtIndex(i: number): GridColumnSize {
	const n = GRID_COLUMN_SIZE_ORDER.length
	const clamped = Math.max(0, Math.min(n - 1, Math.round(i)))
	return GRID_COLUMN_SIZE_ORDER[clamped] as GridColumnSize
}

export function indexForGridColumnSize(size: GridColumnSize | string | undefined): number {
	if (!size) return 0
	const j = (GRID_COLUMN_SIZE_ORDER as readonly string[]).indexOf(size)
	return j === -1 ? 0 : j
}

/** Normalize DB / IPC values (handles missing or snake_case keys). */
export function coerceGridColumnSize(raw: unknown): GridColumnSize {
	if (raw === 'small' || raw === 'medium' || raw === 'large' || raw === 'xlarge') return raw
	return 'large'
}

export function formatCardDate(iso: string) {
    const raw = iso.trim()
    if (!raw) return ''
    const d = new Date(raw.length <= 10 ? `${raw}T12:00:00` : raw)
    if (Number.isNaN(d.getTime())) return ''
    const m = d.getMonth() + 1
    const day = d.getDate()
    const yy = d.getFullYear() % 100
    return `${m}/${day}/${String(yy).padStart(2, '0')}`
}

/**
 * Helper for seeing if there's space to scroll up or down.
 * @param target    Scroll Element
 * @param options   Options for how early client wants to hit the top / bottom
 * @returns         Scroll status as array
 */
export function getVertScrollStatus(target: HTMLElement, options?: { topOffSet?: number, bottomOffSet?: number }): VertScrollStatus {
    const scrollTop = target.scrollTop
    const windowHeight = target.clientHeight
    const scrollHeight = target.scrollHeight
  
    const hasReachedBottom = scrollTop + (options?.bottomOffSet ?? 1) >= scrollHeight - windowHeight
    const hasReachedTop = scrollTop <= (options?.topOffSet ?? 0) 
  
    return { hasReachedBottom, hasReachedTop, details: { scrollTop, scrollHeight, windowHeight } }
  }
  
  /**
   * Helper for seeing if there's space to scroll left or right
   * @param target    Scroll Element
   * @param options   Options for how early client wants to hit the top / bottom
   * @returns         Scroll status as array
   */
  export function getHozScrollStatus(target: HTMLElement, options?: { leftOffSet?: number, rightOffSet?: number }): HozScrollStatus {
    const scrollLeft = target.scrollLeft
    const windowWidth = target.clientWidth
    const scrollWidth = target.scrollWidth
  
    const hasReachedEnd = scrollLeft + (options?.rightOffSet ?? 1) >= scrollWidth - windowWidth
    const hasReachedStart = scrollLeft <= (options?.leftOffSet ?? 0) 
  
    return { hasReachedEnd, hasReachedStart, details: { scrollLeft, scrollWidth, windowWidth } }
  }
  
  /**
   * Generates a masked gradient style on a scrollable element based on scroll status and options.
   * Return scroll state details and styling.
   * 
   * @param  elementn The HTML element to apply the style to.
   * @param  options  gradient style options.
   * @returns         Object containing the styling and horizontal scroll status.
   */
  export function getMaskedGradientStyle(element: HTMLElement, options?: GradientStyleOptions): HozScrollMaskedGradient | VertScrollMaskedGradient {
    const isVertical = options?.isVertical ?? true
    const scrollStatus = isVertical ? getVertScrollStatus(element) : getHozScrollStatus(element)
          
    const angle = isVertical ? "180deg" : "90deg"
    const head = {
        start: options?.head?.start ?? "0%",
        end: options?.head?.end ?? "10%"
    }
    const tail = {
        start: options?.tail?.start ?? "85%",
        end: options?.tail?.end ?? "100%"
    }
  
    const hasReachedEnd = 
        (scrollStatus as VertScrollStatus).hasReachedBottom ?? 
        (scrollStatus as HozScrollStatus).hasReachedEnd;
  
    const hasReachedStart = 
        (scrollStatus as VertScrollStatus).hasReachedTop ?? 
        (scrollStatus as HozScrollStatus).hasReachedStart
  
    let gradient = ""
  
    if (hasReachedEnd && hasReachedStart) {
        gradient = ""
    } 
    else if (!hasReachedEnd && !hasReachedStart) {
        gradient = `linear-gradient(${angle}, transparent ${head.start}, #000 ${head.end}, #000 ${tail.start}, transparent ${tail.end})`
    } 
    else if (!hasReachedStart) {
        gradient = `linear-gradient(${angle}, transparent ${head.start}, #000 ${head.end})`
    } 
    else {
        gradient = `linear-gradient(${angle}, #000 ${tail.start}, transparent ${tail.end})`
    }
  
    const styling = `mask-image: ${gradient}; -webkit-mask-image: ${gradient}`
  
    return options?.isVertical ? { styling, scrollStatus } as VertScrollMaskedGradient : { styling, scrollStatus } as HozScrollMaskedGradient
  }
  

  export const COLOR_SWATCHES = [
    {
      primary: "#ff8e8e",
      light1: "84, 59, 51",
      light2: "255, 224, 214",
      light3: "188, 141, 126",
      dark1: "247, 202, 202",
      dark2: "54, 34, 34",
      dark3: "88, 66, 66",
      dark4: "43, 25, 25",
      name: "red"
    },
    {
      primary: "#FBA490",
      light1: "105, 68, 63",
      light2: "247, 222, 202",
      light3: "180, 145, 140",
      dark1: "245, 209, 197",
      dark2: "58, 40, 34",
      dark3: "99, 75, 69",
      dark4: "42, 30, 23",
      name: "terracotta"
    },
    {
      primary: "#FFC898",
      light1: "108, 90, 58",
      light2: "248, 227, 191", 
      light3: "183, 163, 128",
      dark1: "255, 224, 206",
      dark2: "52, 37, 25",
      dark3: "95, 79, 70",
      dark4: "44, 31, 21",
      name: "orange"
    },
    {
      primary: "#FCDE93",
      light1: "92, 74, 40",
      light2: "255, 241, 188",
      light3: "204, 188, 128",
      dark1: "251, 240, 214",
      dark2: "47, 41, 26",
      dark3: "91, 83, 62",
      dark4: "43, 35, 18",
      name: "yellow"
    },
    {
      primary: "#E6FD8A",
      light1: "86, 110, 66",
      light2: "239, 238, 201",
      light3: "174, 186, 157",
      dark1: "235, 255, 217",
      dark2: "40, 44, 25",
      dark3: "82, 86, 58",
      dark4: "32, 35, 19",
      name: "pear"
    },
    {
      primary: "#d7e5aa",
      light1: "72, 111, 70",
      light2: "221, 237, 192",
      light3: "164, 176, 142",
      dark1: "210, 229, 206",
      dark2: "28, 36, 25",
      dark3: "78, 97, 74",
      dark4: "23, 31, 21",
      name: "green"
    },
    {
      primary: "#D4FFFA",
      light1: "72, 99, 93",
      light2: "219, 238, 236",
      light3: "156, 183, 177",
      dark1: "200, 249, 243",
      dark2: "35, 45, 56",
      dark3: "49, 77, 73",
      dark4: "24, 36, 34",
      name: "teal"
    },
    {
      primary: "#B2E4FF",
      light1: "74, 87, 101",
      light2: "218, 229, 241",
      light3: "142, 163, 185",
      dark1: "192, 219, 252",
      dark2: "36, 42, 54",
      dark3: "68, 83, 95",
      dark4: "27, 30, 40",
      name: "blue"
    },
    {
      primary: "#A5BDFE",
      light1: "86, 95, 109",
      light2: "209, 221, 248",
      light3: "141, 158, 189",
      dark1: "191, 215, 255",
      dark2: "27, 31, 42",
      dark3: "65, 80, 108",
      dark4: "30, 30, 48",
      name: "indigo"
    },
    {
      primary: "#CEC1FF",
      light1: "78, 79, 102",
      light2: "230, 227, 245",
      light3: "171, 172, 212",
      dark1: "211, 192, 242",
      dark2: "36, 37, 60",
      dark3: "80, 68, 98",
      dark4: "37, 29, 41",
      name: "purple"
    },
    {
      primary: "#DDBAFF",
      light1: "99, 91, 108",
      light2: "238, 227, 243",
      light3: "194, 178, 213",
      dark1: "232, 208, 255",
      dark2: "45, 35, 42",
      dark3: "93, 79, 107",
      dark4: "36, 30, 39",
      name: "magenta"
    },
    {
      primary: "#FD8AB9",
      light1: "154, 97, 124",
      light2: "249, 218, 224",
      light3: "220, 179, 198",
      dark1: "255, 198, 233",
      dark2: "55, 35, 47",
      dark3: "95, 72, 89",
      dark4: "42, 26, 37",
      name: "pink"
    },
    {
      primary: "#808080",
      light1: "69, 69, 69",
      light2: "224, 224, 224",
      light3: "172, 172, 172",
      dark1: "240, 240, 240",
      dark2: "40, 40, 40",
      dark3: "64, 64, 64",
      dark4: "31, 31, 31",
      name: "gray"
    },
  ]

export function removeItemArr<T extends { idx: number; id: string | number }>({ array, idx }: { 
    array: T[]
    idx:  number 
  }): { newArray: T[], updated: ReorderItemPayload } {
    const newArray = [...array]
    const updated: ReorderItemPayload = []
    const itemIdx = newArray.findIndex(item => item.idx === idx)
    newArray.splice(itemIdx, 1)
    
    // Update indices for all items that had a higher index
    newArray.forEach(item => {
      if (item.idx > idx) {
        item.idx -= 1
        updated.push({ idx: item.idx, id: `${item.id}` })
      }
    })
    
    return { newArray, updated }
  }

export function insertItemArr<T extends { idx: number; id: string | number }>({
	array,
	item,
	atIdx
}: {
	array: T[]
	item: T
	atIdx?: number
}): { newArray: T[]; updated: ReorderItemPayload } {
	const slot = atIdx ?? item.idx
	const newArray = [...array, item]
	const updated: ReorderItemPayload = []

	for (let i = 0; i < newArray.length; i++) {
		const el = newArray[i]
		if (el === item) continue
		if (el.idx >= slot) {
			el.idx += 1
			updated.push({ idx: el.idx, id: `${el.id}` })
		}
	}

	return { newArray, updated }
}

/**
* Reorders an item in an array by swapping its position with the target position.
* Updates the new index of the the source item.
* Updates in place and returns the new array.
* 
* @param array - The array to reorder.
* @param srcIdx - The index of the source item.
* @param targetIdx - The index of the target item where the source item will be above at.
* @returns The new array with the item reordered.
*/
export function reorderItemArr<T extends { idx: number; id: string | number }>({ 
  array, 
  srcIdx, 
  targetIdx 
}: { array: T[], srcIdx: number, targetIdx: number }): { newArray: T[], updated: ReorderItemPayload } {
  const newArray = [...array]
  const updated: ReorderItemPayload = []
  const direction = srcIdx < targetIdx ? "down" : "up"

  if (direction === "up") {
    for (let i = 0; i < newArray.length; i++) {
      if (newArray[i].idx >= targetIdx && newArray[i].idx < srcIdx) {
        newArray[i].idx += 1
        updated.push({ idx: newArray[i].idx, id: `${newArray[i].id}` })
      } 
      else if (newArray[i].idx === srcIdx) {
        newArray[i].idx = targetIdx
        updated.push({ idx: newArray[i].idx, id: `${newArray[i].id}` })
      }
    }
  } 
  else {
    const toIdx = targetIdx - 1
    if (toIdx < 0 || toIdx >= newArray.length) {
      return { newArray, updated: [] }
    }
    
    for (let i = 0; i < newArray.length; i++) {
      if (newArray[i].idx > srcIdx && newArray[i].idx < targetIdx) {
        newArray[i].idx -= 1
        updated.push({ idx: newArray[i].idx, id: `${newArray[i].id}` })
      } 
      else if (newArray[i].idx === srcIdx) {
        newArray[i].idx = toIdx
        updated.push({ idx: newArray[i].idx, id: `${newArray[i].id}` })
      }
    }
  }

  return { newArray, updated }
}

export function shiftItems<T extends { idx: number }>({ array, fromIdx, toIdx, dir }: {
  array: T[]
  fromIdx: number
  toIdx: number
  dir: 1 | -1
}) {
  for (let i = 0; i < array.length; i++) {
    const item = array[i]
    if (item.idx >= fromIdx && item.idx < toIdx) {
      item.idx += dir
    }
  }

  return array
}

const SNIPPET_ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span'])

/** Visible text for search / empty checks (works without DOM). */
export function snippetPlainText(raw: string | undefined | null): string {
	const s = raw ?? ''
	if (!s) return ''
	if (typeof document !== 'undefined') {
		const tmp = document.createElement('div')
		tmp.innerHTML = s
		return (tmp.innerText || tmp.textContent || '').replace(/\s+/g, ' ').trim()
	}
	return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function sanitizeSpanStyle(style: string | null): string | undefined {
	if (!style?.trim()) return undefined
	const parts = style.split(';').map((p) => p.trim()).filter(Boolean)
	const out: string[] = []
	for (const p of parts) {
		const m = /^([\w-]+)\s*:\s*(.+)$/i.exec(p)
		if (!m) continue
		const k = m[1].toLowerCase().trim()
		const v = m[2].trim()
		if (k === 'font-weight' && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(v)) out.push(`${k}: ${v}`)
		if (k === 'font-style' && /^(normal|italic|oblique)$/i.test(v)) out.push(`${k}: ${v}`)
		if (k === 'text-decoration' && /^[\w\s-]{1,48}$/i.test(v)) out.push(`${k}: ${v}`)
	}
	return out.length ? out.join('; ') : undefined
}

/** Allowed inline-ish HTML for card snippet / quote body; drops scripts, handlers, unknown tags. */
export function sanitizeSnippetHtml(html: string): string {
	const raw = html.trim()
	if (!raw) return ''
	if (typeof document === 'undefined') {
		return raw
			.replace(/<script[\s\S]*?<\/script>/gi, '')
			.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
	}

	const wrap = document.createElement('div')
	wrap.innerHTML = raw

	function walk(el: Element) {
		const kids = [...el.children]
		for (const child of kids) {
			const tag = child.tagName.toLowerCase()
			if (!SNIPPET_ALLOWED_TAGS.has(tag)) {
				while (child.firstChild) el.insertBefore(child.firstChild, child)
				el.removeChild(child)
				continue
			}
			if (tag === 'span') {
				const st = sanitizeSpanStyle(child.getAttribute('style'))
				for (const a of [...child.attributes]) child.removeAttribute(a.name)
				if (st) child.setAttribute('style', st)
			} else {
				for (const a of [...child.attributes]) child.removeAttribute(a.name)
			}
			walk(child)
		}
	}
	walk(wrap)
	return wrap.innerHTML.replace(/^\s+|\s+$/g, '')
}

const RICH_SNIPPET_MARK = /<\s*(b|strong|i|em|u|br|p|div|span)\b/i

/** DB / OG string → HTML for a `contenteditable` snippet field (plain text escaped, existing HTML sanitized). */
export function snippetStorageToEditableHtml(raw: string): string {
	const t = raw ?? ''
	if (!t.trim()) return ''
	if (RICH_SNIPPET_MARK.test(t) || /<\/(b|strong|i|em|u|p|div|span)>/i.test(t)) return sanitizeSnippetHtml(t)
	return t
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/\r\n|\r|\n/g, '<br>')
}

function viewportBox(): BoxSize {
	if (typeof window === 'undefined') return { width: 1200, height: 800 }
	return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * Clamp a `position: fixed` float so it stays inside the **browser viewport** (window).
 * `cursorPos` / `clientOffset` should be in the same coordinate space as `fixed` (typically document client / viewport).
 *
 * @param dims — Float width × height (approximate is fine).
 * @param cursorPos — Anchor point (e.g. right-click or pointer).
 * @param clientOffset — Grab point inside the float (drag); subtracted from cursor.
 * @param margins — Inset from each viewport edge (ns = north/south, ew = east/west).
 */
export function initFloatElemPos(context: {
	dims: BoxSize
	cursorPos: OffsetPoint
	clientOffset?: OffsetPoint
	margins?: { ns: number; ew: number }
}) {
	const { dims, cursorPos, clientOffset, margins = { ns: 0, ew: 0 } } = context
	const containerDims = viewportBox()

	const { width: menuWidth, height: menuHeight } = dims
	const { width: containerWidth, height: containerHeight } = containerDims

	const clientOffsetLeft = clientOffset?.left ?? 0
	const clientOffsetTop = clientOffset?.top ?? 0

	let left = cursorPos.left - clientOffsetLeft
	let top = cursorPos.top - clientOffsetTop

	const marginOffset = {
		left: margins.ew,
		top: margins.ns,
		bottom: margins.ns,
		right: margins.ew
	}
	const containerEdges = {
		top: marginOffset.top,
		left: marginOffset.left,
		right: containerWidth - marginOffset.right,
		bottom: containerHeight - marginOffset.bottom
	}

	const maxLeft = containerEdges.right - menuWidth
	const maxTop = containerEdges.bottom - menuHeight
	left = Math.min(Math.max(left, containerEdges.left), Math.max(containerEdges.left, maxLeft))
	top = Math.min(Math.max(top, containerEdges.top), Math.max(containerEdges.top, maxTop))

	return { left, top }
}