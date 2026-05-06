/** Parse leading emoji + label (collections, chapters, etc.). */
export function getName(val: string) {
	const trimmed = val.trim()
	if (!trimmed) return { emoji: '📌', name: 'Untitled' }

	const emojiRegex = /^\p{Emoji}+/u
	const match = trimmed.match(emojiRegex)

	if (match) {
		const emoji = match[0]
		const name = trimmed.slice(emoji.length).trim()
		return {
			emoji,
			name: name || 'Untitled'
		}
	}
	return { emoji: '📌', name: trimmed }
}
