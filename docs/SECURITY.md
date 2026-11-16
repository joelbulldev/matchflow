# Security model

- WordPress users + cookies + `X-WP-Nonce`
- MATCHFLOW organization RBAC and object-level checks
- Public tokens hashed, scoped, expiring, revocable
- Private file storage under uploads/matchflow-private
- Secrets only in options/env — never in SPA bootstrap
- Quote and status signatures fail-closed
- No unrestricted AI signing or recipient mutation
- CSV export guards formula injection
