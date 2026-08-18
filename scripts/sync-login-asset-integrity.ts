// The login page's Subresource Integrity digests, verified against the CDN.
//
// packages/mcp-server/src/auth.ts pins every third-party asset on the portal-login
// page to a version and to a sha384 digest. The version is checkable by eye; the
// digest is not. Nothing in the server recomputes it, and a test can only assert
// its shape — so a bump that edits the URL and forgets the hash passes every test
// and breaks the entire login flow at run time: the browser blocks the renderer,
// `Formio.createForm` throws `ReferenceError: Formio is not defined`, nothing is
// POSTed to /callback, and `authenticate` hangs on a blank page until it times out.
//
// So the digests are derived, not typed. Run as `pnpm sync:sri` to fetch each
// pinned URL and rewrite auth.ts with the digest of the bytes it served, or
// `pnpm sync:sri --check` to verify without writing — which is what
// login-asset-integrity.test.ts does whenever the network is reachable.
//
// Exit codes are three-way on purpose: 0 agreement, 1 an asset the CDN answered
// about and the answer was wrong, and 2 a CDN that could not be reached at all.
// A test that cannot tell those apart either fails offline or passes on a real
// mismatch; with 2 it skips only the case it genuinely cannot judge.
//
// The line between 1 and 2 is whether the CDN said something about this URL. A
// 404 is an answer — the pinned version does not exist, which is exactly the
// typo this script exists to catch — so it exits 1. Only a transport failure or
// a server-side transient (5xx, 429, 408) means "ask again later" and exits 2.
// Classifying a 404 as unreachable made CI skip the one failure that matters and
// ship a login page whose script tag 404s in the browser.
//
// `--source=<file>` reads the pinned assets from somewhere other than auth.ts, so
// the classification can be exercised on a scratch copy — the same escape hatch
// the neighbouring scripts take with a file or directory argument.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const AUTH_SOURCE = path.join(REPO_ROOT, 'packages/mcp-server/src/auth.ts');

export const UNREACHABLE_EXIT = 2;

// The `url` / `integrity` pairs of LOGIN_PAGE_ASSETS, whatever prettier does to
// the literal's line breaks. Reading the source as text rather than importing it
// keeps this script outside the server package's build, like its neighbours.
const PINNED_ASSET = /url:\s*'([^']+)',\s*integrity:\s*'(sha384-[A-Za-z0-9+/=]+)'/g;

export interface PinnedAsset {
  readonly url: string;
  readonly integrity: string;
}

export function pinnedAssets(source = fs.readFileSync(AUTH_SOURCE, 'utf8')): PinnedAsset[] {
  return [...source.matchAll(PINNED_ASSET)].map(([, url, integrity]) => ({ url, integrity }));
}

export function subresourceIntegrity(body: Uint8Array): string {
  return `sha384-${crypto.createHash('sha384').update(body).digest('base64')}`;
}

/** Thrown when the CDN said nothing about this URL: DNS, TLS, a 5xx, a rate limit. */
class UnreachableAsset extends Error {}

/** Thrown when the CDN answered and the answer was "no such asset". */
class MissingAsset extends Error {}

/** Whether a status means "ask again later" rather than "this URL is wrong". */
export function statusIsTransient(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

async function servedIntegrity(url: string): Promise<string> {
  const response = await fetch(url).catch((error: unknown) => {
    throw new UnreachableAsset(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  });
  if (!response.ok) {
    const detail = `${url}: HTTP ${response.status}`;
    throw statusIsTransient(response.status)
      ? new UnreachableAsset(detail)
      : new MissingAsset(detail);
  }
  return subresourceIntegrity(new Uint8Array(await response.arrayBuffer()));
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--check' && !arg.startsWith('--source='));
  if (unknown.length > 0) {
    console.error(
      `Unknown option(s): ${unknown.join(', ')}\nUsage: sync-login-asset-integrity [--check] [--source=<file>]`
    );
    process.exit(1);
  }

  const sourceArg = args.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);
  const source = sourceArg ? path.resolve(process.cwd(), sourceArg) : AUTH_SOURCE;
  const label = path.relative(REPO_ROOT, source);

  const assets = pinnedAssets(fs.readFileSync(source, 'utf8'));
  if (assets.length === 0) {
    console.error(
      `✗ found no url/integrity pairs in ${label} — LOGIN_PAGE_ASSETS moved or changed shape.`
    );
    process.exit(1);
  }

  // Settled, not `Promise.all`: one unreachable asset used to reject the whole
  // batch, hiding a real digest mismatch on every other asset behind a skip.
  interface AssetResult {
    readonly asset: PinnedAsset;
    readonly integrity?: string;
    readonly error?: Error;
  }

  const results: AssetResult[] = await Promise.all(
    assets.map(async (asset): Promise<AssetResult> => {
      try {
        return { asset, integrity: await servedIntegrity(asset.url) };
      } catch (error: unknown) {
        if (error instanceof UnreachableAsset || error instanceof MissingAsset) {
          return { asset, error };
        }
        throw error;
      }
    })
  );

  const missing = results.flatMap(({ error }) => (error instanceof MissingAsset ? [error] : []));
  const unreachable = results.flatMap(({ error }) =>
    error instanceof UnreachableAsset ? [error] : []
  );
  const wrong = results.flatMap(({ asset, integrity }) =>
    integrity !== undefined && asset.integrity !== integrity ? [{ asset, integrity }] : []
  );

  const missingReport =
    missing.length > 0
      ? '✗ the CDN has no such asset at the pinned URL — check the version in it:\n' +
        missing.map((error) => `  ${error.message}`).join('\n')
      : '';

  if (missing.length === 0 && wrong.length === 0 && unreachable.length === 0) {
    console.log(
      `✓ every login-page asset matches the digest of what the CDN serves (${assets.length} checked)`
    );
    process.exit(0);
  }

  // Only when nothing definitive was learned: a mismatch or a missing asset is a
  // real defect and must not be softened into a skip by an unrelated outage.
  if (missing.length === 0 && wrong.length === 0) {
    console.error(
      `… could not reach the CDN, so nothing was verified (${unreachable[0].message}).`
    );
    process.exit(UNREACHABLE_EXIT);
  }

  if (args.includes('--check') || wrong.length === 0) {
    console.error(
      [
        missingReport,
        wrong.length > 0
          ? '✗ login-page asset digests disagree with the CDN:\n' +
            wrong
              .map(
                ({ asset, integrity }) =>
                  `  ${asset.url}\n    pinned: ${asset.integrity}\n    served: ${integrity}`
              )
              .join('\n') +
            '\n  Run `pnpm sync:sri` to write them — a wrong digest blocks the asset and hangs the login flow.'
          : '',
      ]
        .filter((part) => part.length > 0)
        .join('\n')
    );
    process.exit(1);
  }

  const rewritten = wrong.reduce(
    (text, { asset, integrity }) => text.replace(asset.integrity, integrity),
    fs.readFileSync(source, 'utf8')
  );
  fs.writeFileSync(source, rewritten, 'utf8');
  console.log(
    `✓ rewrote ${wrong.length} digest(s) in ${label}:\n` +
      wrong.map(({ asset }) => `  ${asset.url}`).join('\n')
  );
  // A URL the CDN does not serve cannot be fixed by writing a digest, so the run
  // still fails after writing the ones it could.
  if (missing.length > 0) {
    console.error(missingReport);
    process.exit(1);
  }
}
