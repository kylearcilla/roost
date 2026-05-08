type ContentKind = 'article' | 'book' | 'quote' | 'video' | 'post'

type ContentMeta = {
	readingMinutes?: number
	notesCount?: number
}

type ContentSource = {
	id: string
	name: string
	shortName?: string
	icon: string
	colorCode?: string
	url?: string
	customName?: string
}

type ImageDimsType = '3x2' | 'portrait' | 'square' | 'video' | 'default' | 'auto'

type Media = {
	id: string
	type: 'image' | 'video'
	url?: string
	/** Absolute path of a **copy** under app data (`…/media/<slug>--<id>/…`; main may still allow older roots). Remote assets use `url`. */
	path?: string
	dims: ImageDimsType
}

type GridColumnSize = 'small' | 'medium' | 'large' | 'xlarge'

type ContentItem = {
	id: string
	idx: number
	kind: ContentKind
	collectionIds: string[]
	source?: ContentSource
	title?: string
	snippet?: string
	isBare?: boolean
	media?: Media
	author?: string
	quoteText?: string
	tags: string[]
	meta: ContentMeta
	createdAt?: string
	url?: string
}

type ReorderItemPayload = {
    id: string
    idx: number
}[]

type FavoriteFolder = {
	id: string
	/** Sidebar order within Favorites (same pattern as `Collection.idx`). */
	idx: number
	emoji: string
	name: string
	count: number
	/** Pinned collection: click selects this collection; Remove drops the shortcut only. */
	collectionId?: string
}

type Collection = {
	id: string
	idx: number
	name: string
	headline?: string
	emoji?: string
	subtitle?: string
	columnSize: GridColumnSize
	itemCount?: number
	wallpaper?: Media | null
	wallpaperFocusY?: number
}

type SidebarNavItem = {
	id: string
	label: string
	/** emoji or single char icon */
	icon: string
	count?: number
}

type User = {
	id: string
	displayName: string
	avatarUrl?: string
}

/** Library toolbar: all items, or filter by `Tag.id` on `ContentItem.tags` */
type ContentToolbarFilter = 'all' | string

type DropdownToggleItem = {
	type: 'toggle'
	label: string
	active: boolean
	onToggle: () => void
	margin?: string
	padding?: string
	disabled?: boolean
	if?: boolean
}

type DropdownButtonItem = {
	type: 'btn'
	label: string
	ariaLabel?: string
	id?: string
	disabled?: boolean
	style?: string
	paddingRight?: string
	margin?: string
	padding?: string
	if?: boolean
}

type DropdownDividerItem = {
	type: 'divider'
	margin?: string
	padding?: string
	if?: boolean
}

type DropdownSectionItem = {
	type: 'section'
	name: string
	margin?: string
	padding?: string
	if?: boolean
}

type DropdownContextItem = {
	type: 'context'
	text: string
	margin?: string
	padding?: string
	if?: boolean
}

type DropdownItem =
	| DropdownToggleItem
	| DropdownButtonItem
	| DropdownDividerItem
	| DropdownSectionItem
	| DropdownContextItem
	| undefined
	| null

type TextInputProps = {
	title?: string
	placeholder?: string
	value?: string
	onChange?: (value: string) => void
	onSubmit: ((value: string) => Promise<void>) | ((value: string) => void)
	onClose?: () => void
	offset?: { top: number; left: number }
}

type BoxSize = {
	width: number
	height: number
}

type OffsetPoint = {
	top: number
	left: number
}

type HozScrollStatus = {
    hasReachedEnd: boolean,
    hasReachedStart: boolean,
    details: { 
        scrollLeft: number
        scrollWidth: number
        windowWidth: number 
    }
}

type VertScrollStatus = {
    hasReachedBottom: boolean,
    hasReachedTop: boolean,
    details: { 
        scrollTop: number
        scrollHeight: number
        windowHeight: number 
    }
}

type GradientStyleOptions = {
	isVertical?: boolean
	head?: {
	  start?: string
	  end?: string
	}
	tail?: {
	  start?: string
	  end?: string
	}
  }

type HozScrollMaskedGradient = {
    styling: string,
    scrollStatus: HozScrollStatus
}

type VertScrollMaskedGradient = {
    styling: string,
    scrollStatus: VertScrollStatus
}

/** Palette token (e.g. `FloatInput` `inputType="tag"` swatch + dropdown). */
type Color = {
    primary: string
    name: string
    light1: string
    light2: string
    light3: string
    dark1: string
    dark2: string
    dark3: string
    dark4: string
}

/** Library tag row: items reference `id` in `ContentItem.tags`; scoped to one collection. */
type Tag = {
	id: string
	name: string
	color: Color
	collectionId: string
	columnSize: GridColumnSize
	idx?: number
	description?: string
}