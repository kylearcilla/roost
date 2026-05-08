/**
 * Local / build-time flags (`VITE_*` are exposed by Vite).
 *
 * `.env` / `.env.local` (gitignored): copy from `.env.example`.
 */
const raw = import.meta.env.VITE_USE_MOCK_DATA

/**
 * Dev server: default mocks on (quick UI). Production build: default mocks off (real Electron DB).
 * Override: `VITE_USE_MOCK_DATA=false` / `true` in env for either mode.
 */
export const use_mocks = import.meta.env.PROD
	? raw === 'true' || raw === '1'
	: raw === undefined || raw === '' ? true : raw !== 'false' && raw !== '0'
