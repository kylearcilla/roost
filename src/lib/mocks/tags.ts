import { abs } from '$lib'
import { hashTagLabel } from '$lib/lib/tagLabels'
import { COLOR_SWATCHES } from '$lib/lib/utils'

/** Seed rows before per-collection `idx` is applied (see `SEED_TAGS`). */
const SEED_TAG_ROWS: Omit<Tag, 'idx'>[] = [
	{
		id: '550e8400-e29b-41d4-a716-446655440001',
		name: 'Design',
		color: { ...COLOR_SWATCHES[0] },
		collectionId: 'advice',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440002',
		name: 'Video',
		color: { ...COLOR_SWATCHES[1] },
		collectionId: 'advice',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440003',
		name: 'Video',
		color: { ...COLOR_SWATCHES[1] },
		collectionId: 'swe',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440004',
		name: 'A.I.',
		color: { ...COLOR_SWATCHES[2] },
		collectionId: 'tech',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440005',
		name: 'Quotes',
		color: { ...COLOR_SWATCHES[3] },
		collectionId: 'advice',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440006',
		name: 'Books',
		color: { ...COLOR_SWATCHES[4] },
		collectionId: 'books',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440007',
		name: 'Articles',
		color: { ...COLOR_SWATCHES[5] },
		collectionId: 'tech',
		columnSize: 'small'
	},
	{
		id: '550e8400-e29b-41d4-a716-446655440008',
		name: 'Posts',
		color: { ...COLOR_SWATCHES[6] },
		collectionId: 'advice',
		columnSize: 'small'
	}
]

function withCollectionToolbarIdx(rows: Omit<Tag, 'idx'>[]): Tag[] {
	const nextByCol = new Map<string, number>()
	return rows.map((t) => {
		const i = nextByCol.get(t.collectionId) ?? 0
		nextByCol.set(t.collectionId, i + 1)
		return { ...t, idx: i }
	})
}

/** Stable UUID `Tag.id` values for mock items; mirrored in `libraryTags`. */
export const SEED_TAGS: Tag[] = withCollectionToolbarIdx(SEED_TAG_ROWS)

export function getTag(id: string): Tag | undefined {
	return SEED_TAGS.find((t) => t.id === id)
}

/** Random `Tag.id[]`: length 0–2 inclusive, sampled without replacement from `SEED_TAGS`. */
export function testTags(): string[] {
	const maxPick = Math.min(2, SEED_TAGS.length)
	const count = Math.floor(Math.random() * (maxPick + 1))
	if (count === 0) return []

	const ids = SEED_TAGS.map((t) => t.id)
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const a = ids[i]
		const b = ids[j]
		ids[i] = b
		ids[j] = a
	}
	return ids.slice(0, count)
}

/** abs() dropdown: section “Tags”, then `#slug` buttons. Pass `tagName` so this file need not import `libraryTags` (avoids circular import). */
export function openTagAssignPicker(args: {
	menuId: string
	candidateTagIds: string[]
	tagName: (id: string) => string
	onPick: (tagId: string) => void
	onDismiss?: () => void
}) {
	const items: DropdownItem[] = [{ type: 'section', name: 'Tags' }]
	if (args.candidateTagIds.length === 0) {
		items.push({ type: 'context', text: 'No more tags' })
	} else {
		for (const id of args.candidateTagIds) {
			const name = args.tagName(id)
			items.push({
				type: 'btn',
				label: `#${hashTagLabel(name)}`,
				id
			})
		}
	}
	abs({
		id: args.menuId,
		items,
		dims: { width: 130 },
		offset: { top: 0, left: 0 },
		menuGlass: true,
		onOptnClick: (_label, id) => {
			if (id) args.onPick(id)
			abs.close(args.menuId)
		},
		onClose: () => {
			args.onDismiss?.()
		}
	})
}
