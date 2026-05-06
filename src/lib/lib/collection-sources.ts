type SourceFaviconInput = {
	id: string
	name: string
	shortName?: string
	icon: string
	colorCode?: string
	url?: string
	/** Overrides URL-derived / preset label when non-empty */
	customName?: string
}

export const ID_TO_DOMAIN: Record<string, string> = {
	nyt: 'nytimes.com',
	yt: 'youtube.com',
	x: 'x.com',
	reddit: 'reddit.com',
	medium: 'medium.com',
	penguin: 'penguinrandomhouse.com',
	sj: ''
}

export const SHORT_BY_ID: Record<string, string> = {
	nyt: 'NYT',
	yt: 'Youtube',
	x: 'X',
	reddit: 'Reddit',
	medium: 'Medium',
	penguin: 'Penguin',
	sj: 'SJ'
}

/**
 * Lowercase registrable host segment (e.g. `nytimes` from nytimes.com) → compact label.
 * Used when `source.url` is set; unknown slugs fall back to title case.
 */
export const HOST_SEG_TO_DISPLAY: Record<string, string> = {
	nytimes: 'NYT',
	youtube: 'Youtube',
	x: 'X',
	reddit: 'Reddit',
	medium: 'Medium',
	penguinrandomhouse: 'Penguin',
	github: 'GitHub',
	gitlab: 'GitLab',
	linkedin: 'LinkedIn',
	substack: 'Substack',
	verge: 'Verge',
	theverge: 'Verge',
	axios: 'Axios',
	politico: 'Politico',
	bloomberg: 'Bloomberg',
	reuters: 'Reuters',
	wsj: 'WSJ',
	ft: 'FT',
	apnews: 'AP',
	npr: 'NPR',
	bbc: 'BBC',
	nypost: 'NY Post',
	washingtonpost: 'WaPo',
	arstechnica: 'Ars',
	techcrunch: 'TechCrunch',
	ycombinator: 'HN'
}

/** gTLDs only — ccTLDs / `.co.uk` handled separately */
const GENERIC_TLDS = new Set([
	'com', 'org', 'net', 'io', 'edu', 'gov', 'dev', 'app', 'ai', 'tv', 'me', 'info', 'biz', 'ly',
	'shop', 'tech', 'online', 'site', 'cloud', 'blog', 'art', 'fm', 'gg', 'vc', 'so', 'sh', 'to',
	'xyz', 'page', 'link', 'news', 'world', 'today', 'one', 'club', 'design', 'global', 'studio'
])

/** "wired" / "WIRED" → "Wired" */
function capitalizeSiteWord(raw: string): string {
	const s = raw.trim()
	if (!s) return s
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** Lowercase registrable-ish segment, or `''` / IPv4 handling via null sentinel in caller */
function siteSlugFromHostname(hostname: string): string | null {
	if (hostname.includes(':')) return null

	let h = hostname.toLowerCase()
	if (h.startsWith('www.')) h = h.slice(4)
	const parts = h.split('.').filter(Boolean)
	if (parts.length === 0) return ''

	const ipv4 =
		parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))
	if (ipv4) return null

	if (parts.length === 1) return parts[0]

	const last = parts[parts.length - 1]
	const secondLast = parts[parts.length - 2]
	const twoCharTld = last.length === 2 && /^[a-z]{2}$/.test(last)

	// *.co.uk, *.co.jp, …
	if (twoCharTld && secondLast === 'co' && parts.length >= 3) {
		return parts[parts.length - 3]
	}
	// *.com.au, …
	if (twoCharTld && secondLast === 'com' && parts.length >= 3) {
		return parts[parts.length - 3]
	}
	if (GENERIC_TLDS.has(last)) {
		if (parts.length === 2) return parts[0]
		return parts[parts.length - 2]
	}
	return parts[0]
}

/**
 * Registrable-ish label: wired.com → Wired (or map), nytimes.com → NYT,
 * *.co.uk / *.com.au → segment before registry suffix; IPv6 host unchanged; IPv4 unchanged.
 */
function siteLabelFromHostname(hostname: string): string {
	if (hostname.includes(':')) return hostname

	const slug = siteSlugFromHostname(hostname)
	if (slug === null) return hostname
	if (!slug) return capitalizeSiteWord(hostname)

	const mapped = HOST_SEG_TO_DISPLAY[slug]
	if (mapped) return mapped
	return capitalizeSiteWord(slug)
}

export function sourceDisplayShort(source: SourceFaviconInput): string {
	const custom = source.customName?.trim()
	if (custom) return custom
	if (source.shortName) return source.shortName
	if (source.url) {
		try {
			const host = new URL(source.url).hostname
			if (host) return siteLabelFromHostname(host)
		} catch {
			/* ignore */
		}
	}
	const key = (source.colorCode ?? source.id).toLowerCase()
	return SHORT_BY_ID[key] ?? SHORT_BY_ID[source.id.toLowerCase()] ?? source.name
}

function faviconForHost(hostname: string) {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
}

export function sourceFaviconUrl(source: SourceFaviconInput): string {
	if (source.url) {
		try {
			const host = new URL(source.url).hostname
			if (host) return faviconForHost(host)
		} catch {
			/* ignore */
		}
	}
	const key = (source.colorCode ?? source.id).toLowerCase()
	const host = ID_TO_DOMAIN[key] ?? ID_TO_DOMAIN[source.id.toLowerCase()] ?? ''
	if (!host) return ''
	return faviconForHost(host)
}

/** `URL` accepts junk like `https://23r23` as a single-label host; we only allow real origins. */
function isRecognizableHttpHost(hostname: string): boolean {
	const h = hostname.toLowerCase()
	if (h === 'localhost') return true
	if (h.includes(':')) return true // IPv6
	const parts = h.split('.')
	if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
		return parts.every((p) => {
			const n = Number(p)
			return n >= 0 && n <= 255
		})
	}
	return h.includes('.')
}

function tryParseHttpUrl(raw: string): URL | null {
	const t = raw.trim()
	if (!t) return null
	const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
	try {
		const u = new URL(withScheme)
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
		if (!u.hostname) return null
		if (!isRecognizableHttpHost(u.hostname)) return null
		return u
	} catch {
		return null
	}
}

/** Full normalized `href`, hostname `name`, and s2 favicon URL; `null` if empty / invalid. */
export function extractUrl(raw: string): { href: string; name: string; faviconUrl: string } | null {
	const u = tryParseHttpUrl(raw)
	if (!u) return null
	const domain = u.hostname
	return { href: u.href, name: domain, faviconUrl: faviconForHost(domain) }
}

export function isUrlString(raw: string): boolean {
	return tryParseHttpUrl(raw) !== null
}