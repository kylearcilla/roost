/**
 * Fetches page metadata: Open Graph, Twitter cards, and oEmbed where available.
 * Runs in the browser for the static SPA / Electron shell; some origins block `fetch` (CORS) — in Electron use `electronAPI.fetchMetadata` (main `net.fetch`).
 */

export type ContentProvider =
	| 'youtube'
	| 'tiktok'
	| 'instagram'
	| 'pinterest'
	| 'vimeo'
	| 'x'
	| 'reddit'
	| 'unknown'

/** Normalized metadata from OG, Twitter, and/or oEmbed */
export type FetchedContentMetadata = {
	sourceUrl: string
	canonicalUrl?: string
	provider: ContentProvider
	kind?: 'video' | 'rich' | 'photo' | 'link' | 'article'
	title?: string
	/** Short summary / og:description */
	subtitle?: string
	description?: string
	imageUrl?: string
	/** Card thumbnail aspect: TikTok / reels → portrait, YouTube / native video → video, else → default */
	imageDims?: '3x2' | 'portrait' | 'square' | 'video' | 'default'
	/** Best-effort direct or embed player URL */
	videoUrl?: string
	/** oEmbed iframe or embed snippet */
	embedHtml?: string
	author?: string
	authorUrl?: string
	siteName?: string
	publishedAt?: string
	modifiedAt?: string
	locale?: string
	/** When oEmbed was used, full JSON for extra fields (dimensions, etc.) */
	oembed?: Record<string, unknown>
	/** Key/value from og:* and article:* we did not map to top-level */
	extra?: Record<string, string>
	/** Raw Reddit `t3` post `data` when resolved via `{post}.json` */
	reddit?: Record<string, unknown>
}

/** Plain desktop Chrome UA — explicit bot strings get 403/empty HTML from many publishers. */
const DEFAULT_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function mergeAbortSignals(outer: AbortSignal | null | undefined, inner: AbortSignal): AbortSignal {
	if (!outer) return inner
	if (outer.aborted) {
		const c = new AbortController()
		c.abort(outer.reason)
		return c.signal
	}
	const c = new AbortController()
	const stop = () => c.abort()
	inner.addEventListener('abort', stop, { once: true })
	outer.addEventListener('abort', stop, { once: true })
	return c.signal
}

function escapeRe(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(raw: string): string {
	return raw
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0*39;/g, "'")
		.replace(/&#x0*27;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => {
			const c = Number.parseInt(n, 10)
			return Number.isFinite(c) && c > 0 ? String.fromCodePoint(c) : _
		})
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
			const c = Number.parseInt(h, 16)
			return Number.isFinite(c) && c > 0 ? String.fromCodePoint(c) : _
		})
}

function extractMeta(html: string, key: string, mode: 'property' | 'name'): string | undefined {
	const attr = mode === 'property' ? 'property' : 'name'
	const k = escapeRe(key)
	const patterns = [
		new RegExp(`<meta\\s[^>]*${attr}=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i'),
		new RegExp(`<meta\\s[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${k}["']`, 'i')
	]
	for (const re of patterns) {
		const m = html.match(re)
		if (m?.[1]) return decodeHtmlEntities(m[1])
	}
	return undefined
}

function findOembedJsonHref(html: string): string | undefined {
	for (const m of html.matchAll(/<link\s([^>]+)>/gi)) {
		const attrs = m[1]
		const rel = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
		const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
		const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
		if (!href || !rel || !/\balternate\b/i.test(rel)) continue
		if (!type?.includes('json+oembed')) continue
		return decodeHtmlEntities(href)
	}
	return undefined
}

function extractCanonical(html: string, base: URL): string | undefined {
	const m =
		html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
		html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
	if (!m?.[1]) return undefined
	try {
		return new URL(decodeHtmlEntities(m[1]), base).href
	} catch {
		return undefined
	}
}

function extractIframeSrc(htmlFragment: string): string | undefined {
	const m = htmlFragment.match(/src=["']([^"']+)["']/i)
	return m?.[1] ? decodeHtmlEntities(m[1]) : undefined
}

/**
 * TikTok (any `*.tiktok.com`) or Instagram / Facebook Reel URLs — always portrait (9:16) in the UI.
 * Instagram `/p/…` posts are excluded.
 */
export function isPortraitReelOrTikTokUrl(href: string): boolean {
	const t = href.trim()
	if (!t) return false
	try {
		const u = new URL(t)
		const h = u.hostname.toLowerCase().replace(/^www\./, '')
		if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return true
		const path = u.pathname.toLowerCase()
		if (h === 'instagram.com' || h.endsWith('.instagram.com')) {
			if (/\/(reel|reels)\//i.test(path)) return true
			if (/\/share\/reel\//i.test(path)) return true
			return false
		}
		if (h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.watch') {
			return /\/reels?\//i.test(path)
		}
		return false
	} catch {
		return false
	}
}

function assignThumbnailDims(m: FetchedContentMetadata): void {
	const page = (m.canonicalUrl ?? m.sourceUrl).trim()
	if (m.provider === 'tiktok' || isPortraitReelOrTikTokUrl(page) || isPortraitReelOrTikTokUrl(m.sourceUrl)) {
		m.imageDims = 'portrait'
		return
	}
	if (m.provider === 'youtube') {
		m.imageDims = 'video'
		return
	}
	if (m.kind === 'article' || m.kind === 'link' || m.kind === 'rich' || m.kind === 'photo') {
		m.imageDims = 'default'
		return
	}
	if (m.kind === 'video') {
		m.imageDims = 'video'
		return
	}
	m.imageDims = 'default'
}

function detectProvider(url: URL): ContentProvider {
	const h = url.hostname.replace(/^www\./, '')
	if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'youtube'
	if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
	if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram'
	if (h === 'pin.it' || h === 'pinterest.com' || h.endsWith('.pinterest.com')) return 'pinterest'
	if (h === 'vimeo.com') return 'vimeo'
	if (h === 'x.com' || h === 'twitter.com') return 'x'
	if (h === 'reddit.com' || h.endsWith('.reddit.com') || h === 'redd.it') return 'reddit'
	return 'unknown'
}

function buildRedditJsonUrl(u: URL): string | null {
	const host = u.hostname.toLowerCase()
	if (host === 'redd.it') {
		const id = u.pathname.replace(/^\//, '').split('/')[0]?.replace(/\.json$/i, '')
		if (!id) return null
		const out = new URL(`https://www.reddit.com/comments/${id}.json`)
		out.searchParams.set('raw_json', '1')
		return out.href
	}
	if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
		let path = u.pathname.replace(/\/$/, '') || '/'
		if (!path.endsWith('.json')) path = `${path}.json`
		const out = new URL(path + u.search, `${u.protocol}//${u.host}`)
		out.searchParams.set('raw_json', '1')
		return out.href
	}
	return null
}

function parseRedditListingPost(payload: unknown): Record<string, unknown> | null {
	if (!Array.isArray(payload) || payload.length === 0) return null
	const first = payload[0] as { data?: { children?: Array<{ kind?: string; data?: Record<string, unknown> }> } }
	const kids = first.data?.children
	if (!Array.isArray(kids) || !kids[0]) return null
	const node = kids[0]
	if (node.kind !== 't3' || !node.data || typeof node.data !== 'object') return null
	return node.data
}

async function fetchRedditPostJson(
	pageUrl: URL,
	opts: { signal?: AbortSignal; timeoutMs?: number }
): Promise<Partial<FetchedContentMetadata> | null> {
	const jsonHref = buildRedditJsonUrl(pageUrl)
	if (!jsonHref) return null
	try {
		const text = await fetchText(jsonHref, {
			signal: opts.signal,
			timeoutMs: opts.timeoutMs,
			headers: {
				Accept: 'application/json',
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			}
		})
		const payload = JSON.parse(text) as unknown
		const d = parseRedditListingPost(payload)
		if (!d) return null

		const out: Partial<FetchedContentMetadata> = { reddit: d }

		if (typeof d.title === 'string' && d.title.trim()) out.title = d.title.trim()

		if (typeof d.author === 'string' && d.author) {
			const a = d.author.replace(/^u\//, '')
			out.author = a.startsWith('u/') ? a : `u/${a}`
		}

		if (typeof d.created_utc === 'number' && Number.isFinite(d.created_utc)) {
			out.publishedAt = new Date(d.created_utc * 1000).toISOString()
		}

		const selftext = typeof d.selftext === 'string' ? d.selftext.trim() : ''
		if (selftext) {
			out.description = selftext
			out.subtitle = selftext.slice(0, 500) + (selftext.length > 500 ? '…' : '')
		}

		if (typeof d.subreddit_name_prefixed === 'string') {
			out.siteName = out.siteName ?? `Reddit · ${d.subreddit_name_prefixed}`
		}

		const preview = d.preview as { images?: Array<{ source?: { url?: string } }> } | undefined
		const previewSrc = preview?.images?.[0]?.source?.url
		if (typeof previewSrc === 'string' && /^https?:/i.test(previewSrc)) {
			out.imageUrl = decodeHtmlEntities(previewSrc.replace(/&amp;/g, '&'))
		}

		const thumb = typeof d.thumbnail === 'string' ? d.thumbnail : ''
		if (thumb && /^https?:\/\//i.test(thumb)) out.imageUrl = out.imageUrl ?? thumb

		const sm = d.secure_media as { reddit_video?: { fallback_url?: string; hls_url?: string } } | undefined
		const med = d.media as { reddit_video?: { fallback_url?: string; hls_url?: string } } | undefined
		const vidUrl =
			sm?.reddit_video?.fallback_url ??
			sm?.reddit_video?.hls_url ??
			med?.reddit_video?.fallback_url ??
			med?.reddit_video?.hls_url
		if (typeof vidUrl === 'string' && vidUrl) {
			out.videoUrl = decodeHtmlEntities(vidUrl)
			out.kind = 'video'
		}

		const linkUrl = typeof d.url === 'string' ? d.url : ''
		if (linkUrl && /^https?:\/\//i.test(linkUrl) && !/\/reddit\.com\//i.test(linkUrl)) {
			if (!out.videoUrl && (d.is_video === true || d.post_hint === 'rich:video')) {
				out.videoUrl = linkUrl
			}
			out.extra = {
				...(out.extra ?? {}),
				'reddit:link_url': linkUrl
			}
		}

		if (typeof d.permalink === 'string' && d.permalink.startsWith('/')) {
			try {
				out.canonicalUrl = new URL(d.permalink, 'https://www.reddit.com').href
			} catch {
				/* skip */
			}
		}

		const score = d.score
		const numComments = d.num_comments
		const extra: Record<string, string> = { ...(out.extra ?? {}) }
		if (typeof score === 'number') extra['reddit:score'] = String(score)
		if (typeof numComments === 'number') extra['reddit:num_comments'] = String(numComments)
		if (typeof d.post_hint === 'string') extra['reddit:post_hint'] = d.post_hint
		if (Object.keys(extra).length) out.extra = extra

		if (d.is_video === true || sm?.reddit_video) out.kind = out.kind ?? 'video'

		return out
	} catch {
		return null
	}
}

/** Serialized main-process `net.fetch` result (preload must not construct `Response` — Electron bug). */
type RoostNetPayload = {
	__roostNet: true
	body: string
	status: number
	headers: Record<string, string>
}

function responseFromRoostNetPayload(p: RoostNetPayload): Response {
	const h = p.headers && typeof p.headers === 'object' ? p.headers : {}
	let st = p.status
	if (!Number.isFinite(st) || st < 200 || st > 599) st = 502
	return new Response(p.body, {
		status: st,
		statusText: '',
		headers: new Headers(h)
	})
}

/** Electron: main `net.fetch` via preload; otherwise normal `fetch` (CORS applies). */
async function roostAwareFetch(
	url: string,
	init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
	const bridge =
		typeof window !== 'undefined' && typeof window.electronAPI?.fetchMetadata === 'function'
			? window.electronAPI.fetchMetadata
			: undefined
	if (bridge) {
		const { signal: _skip, ...rest } = init
		const packed = (await bridge(url, rest)) as unknown
		if (
			!packed ||
			typeof packed !== 'object' ||
			!('__roostNet' in packed) ||
			typeof (packed as RoostNetPayload).body !== 'string' ||
			typeof (packed as RoostNetPayload).status !== 'number'
		) {
			throw new TypeError('electronAPI.fetchMetadata: bad payload (restart Electron after preload update)')
		}
		return responseFromRoostNetPayload(packed as RoostNetPayload)
	}
	return fetch(url, init)
}

function normalizeInputUrl(raw: string): URL {
	const trimmed = raw.trim()
	if (!trimmed) throw new Error('Empty URL')
	const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
	return new URL(withProto)
}

async function fetchText(
	url: string,
	init: RequestInit & { timeoutMs?: number } = {}
): Promise<string> {
	const { timeoutMs = 25_000, signal: outer, ...rest } = init
	const ctrl = new AbortController()
	const t = setTimeout(() => ctrl.abort(), timeoutMs)
	const signal = mergeAbortSignals(outer, ctrl.signal)
	let referer: string | undefined
	try {
		referer = `${new URL(url).origin}/`
	} catch {
		referer = undefined
	}
	try {
		const res = await roostAwareFetch(url, {
			...rest,
			signal,
			timeoutMs,
			headers: {
				'User-Agent': DEFAULT_UA,
				Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				...(referer ? { Referer: referer } : {}),
				...(rest.headers as Record<string, string>)
			},
			redirect: 'follow'
		})
		if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
		return await res.text()
	} finally {
		clearTimeout(t)
	}
}

async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
	const text = await fetchText(url, {
		...init,
		headers: { Accept: 'application/json', ...(init.headers as object) }
	})
	return JSON.parse(text) as T
}

type OEmbedPayload = {
	type?: string
	version?: string
	title?: string
	author_name?: string
	author_url?: string
	provider_name?: string
	provider_url?: string
	cache_age?: number
	thumbnail_url?: string
	thumbnail_width?: number
	thumbnail_height?: number
	html?: string
	url?: string
	width?: number | string
	height?: number | string
}

function oEmbedTemplates(pageUrl: string, provider: ContentProvider): string[] {
	const e = encodeURIComponent(pageUrl)
	const list: string[] = []
	if (provider === 'youtube') {
		list.push(`https://www.youtube.com/oembed?url=${e}&format=json`)
		list.push(`https://www.youtube.com/oembed?url=${e}&format=json&maxwidth=1280`)
	}
	if (provider === 'tiktok') list.push(`https://www.tiktok.com/oembed?url=${e}`)
	if (provider === 'vimeo') list.push(`https://vimeo.com/api/oembed.json?url=${e}`)
	if (provider === 'pinterest') {
		list.push(`https://www.pinterest.com/oembed.json?url=${e}`)
		list.push(`https://www.pinterest.com/oembed.json?url=${e}&format=json`)
	}
	if (provider === 'reddit') {
		list.push(`https://www.reddit.com/oembed?url=${e}`)
		list.push(`https://www.reddit.com/oembed.json?url=${e}`)
	}
	/** Instagram’s public oembed often fails; still try common patterns */
	if (provider === 'instagram') list.push(`https://api.instagram.com/oembed?url=${e}`)
	return list
}

function applyOembedToResult(
	base: FetchedContentMetadata,
	payload: OEmbedPayload
): FetchedContentMetadata {
	const o = payload as Record<string, unknown>
	base.oembed = o
	if (payload.type) base.kind = payload.type as FetchedContentMetadata['kind']
	if (payload.title) base.title = payload.title
	if (payload.author_name) base.author = payload.author_name
	if (payload.author_url) base.authorUrl = payload.author_url
	if (payload.provider_name) base.siteName = payload.provider_name
	if (payload.thumbnail_url) base.imageUrl = base.imageUrl ?? payload.thumbnail_url
	if (payload.html) {
		base.embedHtml = payload.html
		base.videoUrl = base.videoUrl ?? extractIframeSrc(payload.html) ?? base.videoUrl
	}
	if (payload.url && !base.videoUrl) base.videoUrl = payload.url
	return base
}

function parseOpenGraph(html: string, pageUrl: URL): Partial<FetchedContentMetadata> {
	const get = (k: string) => extractMeta(html, k, 'property')
	const getn = (k: string) => extractMeta(html, k, 'name')
	const out: Partial<FetchedContentMetadata> = {}
	out.title = get('og:title') ?? getn('title')
	out.description = get('og:description') ?? getn('description')
	out.subtitle = out.description
	out.imageUrl =
		get('og:image:secure_url') ?? get('og:image:url') ?? get('og:image') ?? getn('twitter:image') ?? getn('twitter:image:src')
	out.siteName = get('og:site_name')
	out.videoUrl =
		get('og:video:secure_url') ??
		get('og:video:url') ??
		get('og:video') ??
		getn('twitter:player') ??
		getn('twitter:player:stream')
	const type = get('og:type')
	if (type === 'video.other' || type === 'video.movie') out.kind = 'video'
	else if (type === 'article') out.kind = 'article'
	out.publishedAt =
		get('article:published_time') ??
		get('article:published') ??
		get('og:updated_time') ??
		get('article:modified_time')
	out.modifiedAt = get('article:modified_time') ?? get('og:updated_time')
	out.locale = get('og:locale')
	out.canonicalUrl = extractCanonical(html, pageUrl) ?? pageUrl.href

	const extra: Record<string, string> = {}
	const ogRe = /<meta\s+[^>]*property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi
	let m: RegExpExecArray | null
	while ((m = ogRe.exec(html))) {
		const k = m[1]
		const v = decodeHtmlEntities(m[2])
		if (!['og:title', 'og:description', 'og:image', 'og:image:url', 'og:image:secure_url', 'og:site_name', 'og:video', 'og:video:url', 'og:video:secure_url', 'og:type', 'article:published_time', 'article:modified_time', 'og:updated_time', 'og:locale'].includes(k)) {
			extra[k] = v
		}
	}
	if (Object.keys(extra).length) (out as FetchedContentMetadata).extra = extra

	const twAuthor = getn('twitter:creator') ?? getn('twitter:site')
	if (twAuthor && !out.author) out.author = twAuthor.replace(/^@/, '')

	return out
}

async function tryOembedUrl(oembedUrl: string, signal?: AbortSignal): Promise<OEmbedPayload | null> {
	try {
		return await fetchJson<OEmbedPayload>(oembedUrl, { signal, timeoutMs: 15_000 })
	} catch {
		return null
	}
}

async function tryProviderOembeds(
	pageUrl: string,
	provider: ContentProvider,
	signal?: AbortSignal
): Promise<OEmbedPayload | null> {
	for (const u of oEmbedTemplates(pageUrl, provider)) {
		const p = await tryOembedUrl(u, signal)
		if (p?.title || p?.html || p?.thumbnail_url) return p
	}
	return null
}

async function discoverOembedFromHtml(html: string, base: URL, signal?: AbortSignal) {
	const href = findOembedJsonHref(html)
	if (!href) return null
	let absolute: string
	try {
		absolute = new URL(href, base).href
	} catch {
		return null
	}
	return tryOembedUrl(absolute, signal)
}

function applyRedditMerged(result: FetchedContentMetadata, reddit: Partial<FetchedContentMetadata>): void {
	if (reddit.title) result.title = reddit.title
	if (reddit.author) result.author = reddit.author
	if (reddit.publishedAt) result.publishedAt = reddit.publishedAt
	if (reddit.description) result.description = reddit.description
	if (reddit.subtitle) result.subtitle = reddit.subtitle
	if (reddit.imageUrl) result.imageUrl = reddit.imageUrl
	if (reddit.videoUrl) result.videoUrl = reddit.videoUrl
	if (reddit.kind) result.kind = reddit.kind
	if (reddit.siteName) result.siteName = reddit.siteName
	if (reddit.canonicalUrl) result.canonicalUrl = reddit.canonicalUrl
	if (reddit.reddit) result.reddit = reddit.reddit
	if (reddit.extra) {
		result.extra = { ...(result.extra ?? {}), ...reddit.extra }
	}
}

/**
 * Fetch HTML and merge OG/twitter + oEmbed (provider endpoints + `<link rel="alternate" type="application/json+oembed">`).
 * HTML and provider oEmbed run in parallel so YouTube/TikTok still get `article:published_time` from the page when present.
 */
export async function fetchContentMetadata(
	rawUrl: string,
	opts: { signal?: AbortSignal; timeoutMs?: number; skipOembed?: boolean } = {}
): Promise<FetchedContentMetadata> {
	const pageUrl = normalizeInputUrl(rawUrl)
	const provider = detectProvider(pageUrl)
	const req = { signal: opts.signal, timeoutMs: opts.timeoutMs }

	const result: FetchedContentMetadata = {
		sourceUrl: pageUrl.href,
		provider,
		canonicalUrl: pageUrl.href
	}

	const htmlOutcome = fetchText(pageUrl.href, req).then(
		(h) => ({ ok: true as const, h }),
		(e: unknown) => ({ ok: false as const, e })
	)
	const directPromise = opts.skipOembed
		? Promise.resolve(null as OEmbedPayload | null)
		: tryProviderOembeds(pageUrl.href, provider, opts.signal)
	const redditPromise =
		provider === 'reddit' ? fetchRedditPostJson(pageUrl, req).catch(() => null) : Promise.resolve(null)

	const [ho, directOembed, redditPartial] = await Promise.all([
		htmlOutcome,
		directPromise,
		redditPromise
	])
	const html = ho.ok ? ho.h : null

	if (!html && !directOembed && !redditPartial) {
		const detail =
			ho.ok === false
				? ho.e instanceof Error
					? ho.e.message
					: String(ho.e)
				: 'no HTML, oEmbed, or Reddit payload'
		throw new Error(`Could not load ${pageUrl.href}: ${detail}`)
	}

	if (html) {
		Object.assign(result, parseOpenGraph(html, pageUrl))
		if (!opts.skipOembed) {
			const disc = await discoverOembedFromHtml(html, pageUrl, opts.signal)
			if (disc) applyOembedToResult(result, disc)
		}
	}

	if (!opts.skipOembed && directOembed) applyOembedToResult(result, directOembed)
	if (redditPartial) applyRedditMerged(result, redditPartial)

	return mergePreferFilled(result)
}

function mergePreferFilled(m: FetchedContentMetadata): FetchedContentMetadata {
	if (m.subtitle === undefined && m.description) m.subtitle = m.description
	const ot = m.oembed && typeof m.oembed.title === 'string' ? (m.oembed.title as string) : ''
	if ((!m.title || m.title.trim().length < 2) && ot) m.title = ot
	assignThumbnailDims(m)
	return m
}

/** Lower-level: only oEmbed (no HTML fetch except for discovery URL you pass). */
export async function fetchOembedForUrl(
	pageUrl: string,
	opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<OEmbedPayload | null> {
	const url = normalizeInputUrl(pageUrl)
	const provider = detectProvider(url)
	const direct = await tryProviderOembeds(url.href, provider, opts.signal)
	if (direct) return direct
	const html = await fetchText(url.href, { signal: opts.signal, timeoutMs: opts.timeoutMs })
	return discoverOembedFromHtml(html, url, opts.signal)
}

// ——— Image URL validation (browser + shared types; HEAD + CORS fallback probe) ———

export type ImgUploadConstraints = {
	formats: readonly string[]
}

/** Allowed `Content-Type` main parts for `validateImgURL` when the server sends a type */
export const DEFAULT_IMG_UPLOAD_CONSTRAINTS: ImgUploadConstraints = {
	formats: ['image/avif', 'image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
}

export const ImgUploadError = {
	InvalidURL: 'InvalidURL',
	BadFormat: 'BadFormat',
	NotFound: 'NotFound',
	CorsBlocked: 'CorsBlocked',
	General: 'General'
} as const

export type ImgUploadErrorKind = (typeof ImgUploadError)[keyof typeof ImgUploadError]

export class ImgInputError extends Error {
	readonly code: ImgUploadErrorKind
	constructor(code: ImgUploadErrorKind) {
		super(code)
		this.name = 'ImgInputError'
		this.code = code
	}
}

function normalizeImgMimePart(raw: string | null | undefined): string | null {
	if (!raw) return null
	const main = raw.split(';')[0].trim().toLowerCase()
	if (main === 'image/jpg') return 'image/jpeg'
	return main
}

function verifyImgFormat(contentType: string | null, formats: readonly string[]): void {
	const main = normalizeImgMimePart(contentType)
	if (!main) return
	if (!main.startsWith('image/')) {
		if (main === 'application/octet-stream') return
		throw new ImgInputError(ImgUploadError.BadFormat)
	}
	const allowed = new Set(formats.map((f) => normalizeImgMimePart(f) ?? f))
	if (allowed.size > 0 && !allowed.has(main)) {
		throw new ImgInputError(ImgUploadError.BadFormat)
	}
}

function probeImageUrl(url: string, signal?: AbortSignal): Promise<void> {
	if (typeof Image === 'undefined') {
		return Promise.reject(new ImgInputError(ImgUploadError.CorsBlocked))
	}
	return new Promise((resolve, reject) => {
		const img = new Image()
		let settled = false
		const end = (fn: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(tid)
			signal?.removeEventListener('abort', onAbort)
			fn()
		}
		const onAbort = () => end(() => reject(new DOMException('Aborted', 'AbortError')))
		const tid = setTimeout(() => end(() => reject(new ImgInputError(ImgUploadError.General))), 18_000)
		img.onload = () => end(() => resolve())
		img.onerror = () => end(() => reject(new ImgInputError(ImgUploadError.General)))
		if (signal) {
			if (signal.aborted) {
				onAbort()
				return
			}
			signal.addEventListener('abort', onAbort, { once: true })
		}
		img.src = url
	})
}

async function handleCorsErrorRequest(
	url: string,
	_formats: readonly string[],
	signal?: AbortSignal
): Promise<void> {
	await probeImageUrl(url, signal)
}

/**
 * Best-effort check that `url` points to an image: `HEAD` + `Content-Type`, or
 * `<img>` decode when `fetch` fails with `TypeError` (typical CORS / opaque failures in the browser).
 */
export async function validateImgURL({
	url,
	constraints,
	signal
}: {
	url: string
	constraints: ImgUploadConstraints
	signal?: AbortSignal
}): Promise<void> {
	const { formats } = constraints
	const headers = new Headers({
		Accept: 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/gif'
	})

	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		throw new ImgInputError(ImgUploadError.InvalidURL)
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new ImgInputError(ImgUploadError.InvalidURL)
	}

	try {
		const res = await roostAwareFetch(parsed.href, {
			method: 'HEAD',
			headers,
			signal,
			mode: 'cors'
		})
		if (res.status === 405 || res.status === 501) {
			await handleCorsErrorRequest(parsed.href, formats, signal)
			return
		}
		if (!res.ok) {
			if (res.status === 404) throw new ImgInputError(ImgUploadError.NotFound)
			throw new ImgInputError(ImgUploadError.General)
		}
		verifyImgFormat(res.headers.get('content-type'), formats)
	} catch (error: unknown) {
		if (error instanceof ImgInputError) throw error
		if (error instanceof DOMException && error.name === 'AbortError') throw error
		if (error instanceof TypeError) {
			await handleCorsErrorRequest(parsed.href, formats, signal)
			return
		}
		throw new ImgInputError(ImgUploadError.General)
	}
}
