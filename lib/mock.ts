/**
 * Mock API mode (front-end spec §20): `NEXT_PUBLIC_MOCK_API=1` runs the whole UI against MSW
 * with a fake signed-in user and no back end. Inlined at build time, so it works on both sides.
 */
export const MOCK_API = process.env.NEXT_PUBLIC_MOCK_API === "1";
