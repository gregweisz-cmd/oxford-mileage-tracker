/**
 * CRA 5 runs fork-ts-checker in a child process; on Vercel (and large
 * StaffPortal.tsx) that worker often SIGABRTs from memory pressure while the
 * webpack compile itself succeeds. Type-check separately via `npm run typecheck`.
 */
module.exports = {
  typescript: {
    enableTypeChecking: false,
  },
};
