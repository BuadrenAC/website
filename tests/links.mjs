// Checks every link in docs/. Internal links and #fragments always; external
// URLs with --external (CI runs that weekly, so a dead link gets noticed).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const docs = resolve(import.meta.dirname, '..', 'docs');
const external = process.argv.includes('--external');
const pages = readdirSync(docs).filter((file) => file.endsWith('.html'));
const html = Object.fromEntries(pages.map((page) => [page, readFileSync(join(docs, page), 'utf8')]));
const failures = [];
const remote = new Map();

const hasId = (page, id) => new RegExp(`\\sid="${id}"`).test(html[page]);

for (const page of pages) {
  const refs = [...html[page].matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)].map((match) => match[1]);

  for (const ref of refs) {
    if (/^https?:\/\//.test(ref)) {
      if (!remote.has(ref)) remote.set(ref, new Set());
      remote.get(ref).add(page);
      continue;
    }

    const [path, fragment] = ref.split('#');
    const target = path === '' ? page : path === '/' ? 'index.html' : path.replace(/^\//, '');
    const file = path.startsWith('/') ? join(docs, target) : join(dirname(join(docs, page)), target);

    if (!existsSync(file)) failures.push(`${page}: broken link ${ref}`);
    else if (fragment && !hasId(target, fragment)) failures.push(`${page}: no #${fragment} in ${target}`);
  }
}

// These only exist as metadata about our own pages, which may not be deployed yet.
const own = (url) => url.startsWith('https://www.buadren.com/');
// schema.org and sitemaps.org namespaces aren't pages; Discord refuses bots.
const skip = (url) => own(url) || /^https:\/\/discord\.gg\//.test(url);

if (external) {
  const urls = [...remote.keys()].filter((url) => !skip(url));
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(30_000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; buadren-link-check)' },
        });
        if (response.status >= 400) failures.push(`${url}: HTTP ${response.status} (${[...remote.get(url)]})`);
      } catch (error) {
        failures.push(`${url}: ${error.cause?.code ?? error.message} (${[...remote.get(url)]})`);
      }
    })
  );
}

if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`✓ links ok (${pages.length} pages${external ? `, ${remote.size} external URLs` : ''})`);
