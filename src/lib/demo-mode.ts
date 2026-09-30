/**
 * DEMO MODE: the owner dashboard is intentionally open to guests for the challenge.
 * Every owner read/write goes through `ownerDb()` in owner-db.server.ts and this single flag.
 * Flip to `false` to require a signed-in admin (user_roles.role = 'admin').
 */
export const DEMO_MODE = true;
