/**
 * Local / build-time flags (`VITE_*` are exposed by Vite).
 *
 * `.env` / `.env.local` (gitignored): copy from `.env.example`.
 */
const raw = import.meta.env.VITE_USE_MOCK_DATA

/** When `true` (default): seed from `$lib/mocks`. When `false`: empty client state; load from DB in Electron (wire `hydrateFromDb` etc.). */
export const use_mocks =
	raw === undefined || raw === '' ? true : raw !== 'false' && raw !== '0'
