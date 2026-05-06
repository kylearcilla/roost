import { testTags } from '$lib/mocks/tags'

export const mockUser: LibraryUser = {
	id: 'u1',
	displayName: 'Georgina Huang',
	avatarUrl: 'https://i.pinimg.com/736x/ed/05/ae/ed05aececd1ee5f289a4f43eeb5afa4f.jpg'
	// displayName: 'Kyle Arcilla',
	// avatarUrl: 'https://i.pinimg.com/736x/2a/72/37/2a7237c749f279f29d561f77daf566f7.jpg'
}

export const mockSidebarNav: SidebarNavItem[] = [
	{ id: 'home', label: 'Home', icon: '🏠' },
	{ id: 'settings', label: 'Settings', icon: '⚡' }
]

export const mockFavorites: FavoriteFolder[] = [
	{ id: 'f1', idx: 0, emoji: '✏️', name: 'Productivity', count: 18 },
	{ id: 'f2', idx: 1, emoji: '🧬', name: 'Tech', count: 23 }
]

export const mockCollections: Collection[] = [
	{ id: 'swe', idx: 0, name: 'SWE', emoji: '💻', itemCount: 6, columnSize: 'large' },
	{ id: 'books', idx: 1, name: 'Books', emoji: '📚', itemCount: 3, columnSize: 'large' },
	{
		id: 'advice',
		idx: 2,
		name: 'Advice',
		headline: 'Lifestyle',
		emoji: '👏',
		subtitle: 'Art. Design. Productivity. Etc...',
		itemCount: 11,
		columnSize: 'large'
	},
	{ id: 'tech', idx: 3, name: 'Tech', emoji: '🧬', itemCount: 23, columnSize: 'large' },
	{ id: 'health', idx: 4, name: 'Health', emoji: '❤️', itemCount: 3, columnSize: 'large' },
	{
		id: 'entrepreneurship',
		idx: 5,
		name: 'Entrepreneurship',
		emoji: '💵',
		itemCount: 14,
		columnSize: 'large'
	},
	{ id: 'productivity', idx: 6, name: 'Productivity', emoji: '✏️', itemCount: 18, columnSize: 'large' },
	{ id: 'art', idx: 7, name: 'Art', emoji: '🖼️', itemCount: 11, columnSize: 'large' },
	{ id: 'asoif', idx: 8, name: 'ASOIF', emoji: '👑', itemCount: 11, columnSize: 'large' }
]

const src = (id: string, name: string, icon: string, url?: string, shortName?: string) => ({
	id,
	name,
	icon,
	url,
	...(shortName ? { shortName } : {})
})

export const mockContentItems: ContentItem[] = [
	{
		id: 'c1',
		idx: 0,
		kind: 'article',
		collectionIds: ['advice', 'art'],
		source: src('nyt', 'The New York Times', '📰', 'https://nytimes.com'),
		title: 'What Good Design Still Means',
		snippet: 'In a world of templates and AI drafts, intention still wins.',
		media: {
			type: 'image',
			url: 'https://picsum.photos/seed/roost1/640/400',
			dims: 'default'
		},
		meta: { readingMinutes: 6, notesCount: 2 },
		tags: testTags(),
		createdAt: '2026-04-01'
	},
	{
		id: 'c2',
		idx: 1,
		kind: 'video',
		collectionIds: ['advice', 'tech'],
		source: src('yt', 'YouTube', '▶️'),
		title: 'Local Project — Architecture Walkthrough',
		snippet: 'A calm tour through structure, light, and material.',
		media: {
			type: 'image',
			url: 'https://picsum.photos/seed/roost2/640/360',
			dims: 'video'
		},
		meta: { readingMinutes: 14, notesCount: 0 },
		tags: testTags(),
		createdAt: '2026-04-12'
	},
	{
		id: 'c3',
		idx: 2,
		kind: 'post',
		collectionIds: ['tech'],
		source: src('x', 'X', '𝕏', 'https://x.com'),
		title: 'Hot take on context windows',
		snippet: 'Long context is not a substitute for good retrieval.',
		meta: { readingMinutes: 1, notesCount: 5 },
		tags: testTags(),
		createdAt: '2026-04-18'
	},
	{
		id: 'c4',
		idx: 3,
		kind: 'quote',
		collectionIds: ['advice', 'productivity'],
		title: 'On craft',
		quoteText:
			'Design is not just what it looks like and feels like. Design is how it works.',
		author: 'Steve Jobs',
		meta: { readingMinutes: 1, notesCount: 3 },
		tags: testTags(),
		createdAt: '2026-03-20'
	},
	{
		id: 'c5',
		idx: 4,
		kind: 'book',
		collectionIds: ['books', 'art'],
		source: src('penguin', 'Penguin', '🐧'),
		title: 'Art as Therapy',
		snippet: 'Alain de Botton & John Armstrong',
		media: {
			type: 'image',
			url: 'https://picsum.photos/seed/roostbook/320/480',
			dims: 'portrait'
		},
		author: 'Alain de Botton',
		meta: { readingMinutes: 180, notesCount: 8 },
		tags: testTags(),
		createdAt: '2026-02-10'
	},
	{
		id: 'c6',
		idx: 5,
		kind: 'article',
		collectionIds: ['tech'],
		source: src('reddit', 'Reddit', '🔶', 'https://reddit.com'),
		title: 'Why we still reach for boring stacks',
		snippet: 'Boring technology club membership keeps growing.',
		media: {
			type: 'image',
			url: 'https://picsum.photos/seed/roost3/640/520',
			dims: 'default'
		},
		meta: { readingMinutes: 9, notesCount: 1 },
		tags: testTags(),
		createdAt: '2026-04-22'
	},
	{
		id: 'c7',
		idx: 6,
		kind: 'post',
		collectionIds: ['advice'],
		source: src('medium', 'Medium', 'M', 'https://medium.com'),
		title: 'Notes from a slower news diet',
		snippet: 'Less feed, more finish.',
		meta: { readingMinutes: 4, notesCount: 0 },
		tags: testTags(),
		createdAt: '2026-04-28'
	},
	{
		id: 'c8',
		idx: 7,
		kind: 'video',
		collectionIds: ['swe'],
		source: src('yt2', 'YouTube', '▶️'),
		title: 'Refactors that pay rent',
		snippet: 'When incremental beats the big rewrite.',
		media: {
			type: 'image',
			url: 'https://picsum.photos/seed/roost4/640/380',
			dims: 'video'
		},
		meta: { readingMinutes: 22, notesCount: 4 },
		tags: testTags(),
		createdAt: '2026-04-15'
	}
]
