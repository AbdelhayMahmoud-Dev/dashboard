/**
 * Patches a known Next.js 16.2.6 bug where static generation of the synthetic
 * /_global-error route fails with:
 *
 *   InvariantError: Expected workStore to be initialized. This is a bug in Next.js.
 *
 * Root cause: during the export phase, lazyRenderAppPage is invoked for
 * /_global-error but workStore is not initialised for this synthetic route.
 *
 * Fix: in two places mark /_global-error as dynamic (revalidate:0) so it is
 * excluded from staticPaths AND so the export worker returns early without
 * calling lazyRenderAppPage. Both the CJS and ESM copies are patched because
 * Turbopack may load either.
 *
 * Why a custom script instead of patch-package:
 *   In an npm-workspace setup, `next` is hoisted to the workspace root
 *   node_modules/ on local installs but lives in frontend/node_modules/ when
 *   Vercel installs from Root Directory = frontend. patch-package looks
 *   relative to cwd only and silently fails in whichever environment doesn't
 *   match. require.resolve walks the standard module-resolution chain and
 *   finds next regardless of where npm hoisted it.
 *
 * The script is idempotent: a PATCH_MARKER short-circuits re-application.
 */

const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '// PATCHED (Next.js 16.2.6 workStore bug)';
const EXPECTED_NEXT_VERSION = '16.2.6';

function resolveNextPackageDir() {
  try {
    return path.dirname(require.resolve('next/package.json', { paths: [__dirname] }));
  } catch (e) {
    console.error('[patch-next-build] FATAL: could not resolve `next` package.', e.message);
    process.exit(1);
  }
}

function applyPatch({ file, original, patched }) {
  const label = path.relative(process.cwd(), file);

  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`[patch-next-build] FATAL: could not read ${label}: ${e.message}`);
    process.exit(1);
  }

  if (content.includes(PATCH_MARKER)) {
    console.log(`[patch-next-build] already patched, skipping: ${label}`);
    return;
  }

  if (!content.includes(original)) {
    console.error(
      `[patch-next-build] FATAL: expected pre-patch source not found in ${label}. ` +
      `The Next.js version may have changed; verify this patch is still needed.`
    );
    process.exit(1);
  }

  fs.writeFileSync(file, content.replace(original, patched), 'utf8');
  console.log(`[patch-next-build] applied workStore fix to ${label}`);
}

const nextDir = resolveNextPackageDir();
const installedVersion = require(path.join(nextDir, 'package.json')).version;

if (installedVersion !== EXPECTED_NEXT_VERSION) {
  console.error(
    `[patch-next-build] FATAL: patch targets next@${EXPECTED_NEXT_VERSION} but ` +
    `next@${installedVersion} is installed. Re-validate the patch against the ` +
    `new version and update EXPECTED_NEXT_VERSION before deploying.`
  );
  process.exit(1);
}

const distDir = path.join(nextDir, 'dist');

const patches = [
  // ── 1. dist/build/utils.js (CJS) ────────────────────────────────────────
  // Mark /_global-error as dynamic so it is NOT added to staticPaths during
  // the "Collecting page data" phase.
  {
    file: path.join(distDir, 'build', 'utils.js'),
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
        // PATCHED (Next.js 16.2.6 workStore bug): return dynamic so this
        // route is excluded from staticPaths.
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

  // ── 2. dist/esm/build/utils.js (ESM) ────────────────────────────────────
  {
    file: path.join(distDir, 'esm', 'build', 'utils.js'),
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
        // PATCHED (Next.js 16.2.6 workStore bug): return dynamic so this
        // route is excluded from staticPaths.
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

  // ── 3. dist/export/routes/app-page.js (CJS) ─────────────────────────────
  // Return early so lazyRenderAppPage is never called for this route.
  {
    file: path.join(distDir, 'export', 'routes', 'app-page.js'),
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

  // ── 4. dist/esm/export/routes/app-page.js (ESM) ─────────────────────────
  {
    file: path.join(distDir, 'esm', 'export', 'routes', 'app-page.js'),
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
  },
];

for (const p of patches) {
  applyPatch(p);
}

console.log(`[patch-next-build] done (next@${installedVersion} at ${path.relative(process.cwd(), nextDir)})`);
