/** Lowercase slug for hashtag display (matches card footer). */
export function hashTagLabel(raw: string): string {
	const trimmed = raw.trim().replace(/^#+/i, '')
	const compact = trimmed.toLowerCase().replace(/\s+/g, '')
	if (!compact) return 'tag'
	const uuidish =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compact)
	if (uuidish) return compact.replace(/-/g, '').slice(0, 8)
	return compact
}
