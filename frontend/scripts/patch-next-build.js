/**
 * Patches a known Next.js 16.2.6 bug where the static generation of the
 * synthetic /_global-error route fails with:
 *
 *   InvariantError: Expected workStore to be initialized. This is a bug in Next.js.
 *
 * Root cause: when the export phase tries to render /_global-error statically,
 * lazyRenderAppPage calls resolveMetadata which requires workStore to be
 * initialized — but workStore is not set up for this synthetic route.
 *
 * Fix: in export/routes/app-page.js, return a dynamic (revalidate: 0) result
 * immediately for /_global-error/page without attempting to render it. This
 * mirrors how other "dynamic" pages are handled — the page is considered
 * server-rendered only and is never statically prerendered.
 *
 * Two places need patching:
 *   1. dist/build/utils.js (CJS) — isPageStatic early return for /_global-error
 *      must return appConfig.revalidate = 0 so the route is NOT added to
 *      staticPaths during the "Collecting page data" phase.
 *   2. dist/export/routes/app-page.js (CJS) — the export render must also
 *      return early, because even if staticPaths skips it the export worker
 *      still attempts the render for routes in exportPathMap.
 *
 * Note: dist/esm/... copies are also patched — Next.js Turbopack may use them.
 */

const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '// PATCHED (Next.js 16.2.6 workStore bug)';

function applyPatch({ file, original, patched }) {
  const label = path.relative(path.join(__dirname, '..', 'node_modules'), file);

  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.warn(`[patch-next-build] WARNING: Could not read ${label}: ${e.message}`);
    return false;
  }

  if (content.includes(PATCH_MARKER)) {
    console.log(`[patch-next-build] Already patched — skipping: ${label}`);
    return true;
  }

  if (!content.includes(original)) {
    console.warn(
      `[patch-next-build] WARNING: Expected patch target not found in ${label}. ` +
      'The Next.js version may have changed — verify the patch is still needed.'
    );
    return false;
  }

  fs.writeFileSync(file, content.replace(original, patched), 'utf8');
  console.log(`[patch-next-build] Applied workStore fix to ${label}`);
  return true;
}

const base = path.join(__dirname, '..', 'node_modules', 'next', 'dist');

const patches = [
  // ── Patch 1: build/utils.js (CJS) ────────────────────────────────────────
  // Make isPageStatic return revalidate:0 for /_global-error so it is NOT
  // added to staticPaths during the "Collecting page data" phase.
  {
    file: path.join(base, 'build', 'utils.js'),
    original:
`    // Skip page data collection for synthetic _global-error routes
    if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {
        return {
            isStatic: true,
            isRoutePPREnabled: false,
            prerenderFallbackMode: undefined,
            prerenderedRoutes: undefined,
            rootParamKeys: undefined,
            hasStaticProps: false,
            hasServerProps: false,
            isNextImageImported: false,
            appConfig: {}
        };
    }`,
    patched:
`    // Skip page data collection for synthetic _global-error routes
    if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {
        // PATCHED (Next.js 16.2.6 workStore bug): return revalidate:0 so this
        // route is treated as dynamic and excluded from staticPaths.
        return {
            isStatic: false,
            isRoutePPREnabled: false,
            prerenderFallbackMode: undefined,
            prerenderedRoutes: undefined,
            rootParamKeys: undefined,
            hasStaticProps: false,
            hasServerProps: false,
            isNextImageImported: false,
            appConfig: { dynamic: 'force-dynamic', revalidate: 0 }
        };
    }`,
  },

  // ── Patch 2: build/utils.js (ESM) ────────────────────────────────────────
  {
    file: path.join(base, 'esm', 'build', 'utils.js'),
    original:
`    // Skip page data collection for synthetic _global-error routes
    if (page === UNDERSCORE_GLOBAL_ERROR_ROUTE) {
        return {
            isStatic: true,
            isRoutePPREnabled: false,
            prerenderFallbackMode: undefined,
            prerenderedRoutes: undefined,
            rootParamKeys: undefined,
            hasStaticProps: false,
            hasServerProps: false,
            isNextImageImported: false,
            appConfig: {}
        };
    }`,
    patched:
`    // Skip page data collection for synthetic _global-error routes
    if (page === UNDERSCORE_GLOBAL_ERROR_ROUTE) {
        // PATCHED (Next.js 16.2.6 workStore bug): return revalidate:0 so this
        // route is treated as dynamic and excluded from staticPaths.
        return {
            isStatic: false,
            isRoutePPREnabled: false,
            prerenderFallbackMode: undefined,
            prerenderedRoutes: undefined,
            rootParamKeys: undefined,
            hasStaticProps: false,
            hasServerProps: false,
            isNextImageImported: false,
            appConfig: { dynamic: 'force-dynamic', revalidate: 0 }
        };
    }`,
  },

  // ── Patch 3: export/routes/app-page.js (CJS) ─────────────────────────────
  // Return early for /_global-error before calling lazyRenderAppPage, which
  // fails with the workStore invariant. Returning revalidate:0 signals dynamic.
  {
    file: path.join(base, 'export', 'routes', 'app-page.js'),
    original:
`    // If the page is \`/_global-error\`, then we should update the page to be \`/500\`.
    if (page === _entryconstants.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY) {
        isDefaultGlobalError = true;
        pathname = '/500';
    }
    try {`,
    patched:
`    // If the page is \`/_global-error\`, then we should update the page to be \`/500\`.
    if (page === _entryconstants.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY) {
        isDefaultGlobalError = true;
        pathname = '/500';
        // PATCHED (Next.js 16.2.6 workStore bug): lazyRenderAppPage fails for
        // this route because workStore is not initialised during static
        // generation. Return dynamic (revalidate:0) to skip static prerender.
        return { cacheControl: { revalidate: 0, expire: undefined } };
    }
    try {`,
  },

  // ── Patch 4: export/routes/app-page.js (ESM) — if it exists ─────────────
  // (Turbopack may use the ESM version)
];

// The ESM export route may or may not exist — add it optionally:
const esmAppPagePath = path.join(base, 'esm', 'export', 'routes', 'app-page.js');
if (fs.existsSync(esmAppPagePath)) {
  patches.push({
    file: esmAppPagePath,
    original:
`    // If the page is \`/_global-error\`, then we should update the page to be \`/500\`.
    if (page === UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY) {
        isDefaultGlobalError = true;
        pathname = '/500';
    }
    try {`,
    patched:
`    // If the page is \`/_global-error\`, then we should update the page to be \`/500\`.
    if (page === UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY) {
        isDefaultGlobalError = true;
        pathname = '/500';
        // PATCHED (Next.js 16.2.6 workStore bug): lazyRenderAppPage fails for
        // this route because workStore is not initialised during static
        // generation. Return dynamic (revalidate:0) to skip static prerender.
        return { cacheControl: { revalidate: 0, expire: undefined } };
    }
    try {`,
  });
}

let patchedCount = 0;
for (const p of patches) {
  if (applyPatch(p)) patchedCount++;
}

if (patchedCount === 0) {
  console.error('[patch-next-build] ERROR: No files were patched. Build may fail.');
  process.exit(1);
}
