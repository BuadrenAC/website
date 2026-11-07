// Things no off-the-shelf linter knows about this site. The nav, footer, and
// server address are copied by hand between pages, so this keeps them in step.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const docs = resolve(import.meta.dirname, '..', 'docs');
const read = (file) => readFileSync(join(docs, file), 'utf8');
const pages = ['index.html', 'play.html', 'changelog.html'];
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const section = (html, pattern) => (html.match(pattern)?.[0] ?? '').replace(/ aria-current="page"/g, '');
const nav = (html) => section(html, /<header class="site-header">[\s\S]*?<\/header>/);
const footer = (html) => section(html, /<footer class="site-footer">[\s\S]*?<\/footer>/);

for (const page of pages) {
  const html = read(page);

  check(nav(html) === nav(read('index.html')), `${page}: nav differs from index.html`);
  check(footer(html) === footer(read('index.html')), `${page}: footer differs from index.html`);
  check((html.match(/aria-current="page"/g) ?? []).length === 1, `${page}: needs exactly one aria-current link`);
  check(!html.includes('target="_blank"'), `${page}: don't open new tabs without warning`);

  const path = page === 'index.html' ? '' : page;
  check(read('sitemap.xml').includes(`<loc>https://www.buadren.com/${path}</loc>`), `sitemap.xml: missing ${page}`);
  check(html.includes(`<link rel="canonical" href="https://www.buadren.com/${path}">`), `${page}: wrong canonical URL`);
}

// The home page teaser has to track the top of the changelog.
const changelog = read('changelog.html');
const home = read('index.html');
const entries = [...changelog.matchAll(/<article class="changelog-entry" id="([^"]+)"[\s\S]*?<time[^>]*datetime="([^"]+)"[^>]*>([^<]+)<\/time>/g)];
const teasers = [...home.matchAll(/<time class="teaser-date" datetime="([^"]+)">[^<]+<\/time>[\s\S]*?href="changelog\.html#([^"]+)"/g)];

check(teasers.length === 3, `index.html: expected 3 changelog teasers, found ${teasers.length}`);
teasers.forEach((teaser, i) => {
  check(teaser[2] === entries[i]?.[1], `index.html: teaser ${i + 1} should be "${entries[i]?.[1]}", is "${teaser[2]}"`);
  check(teaser[1] === entries[i]?.[2], `index.html: teaser ${i + 1} date doesn't match its changelog entry`);
});

const ids = entries.map((entry) => entry[1]);
check(new Set(ids).size === ids.length, 'changelog.html: duplicate entry ids');
for (const entry of changelog.matchAll(/data-tags="([^"]+)"/g)) {
  for (const tag of entry[1].split(' ')) {
    check(changelog.includes(`data-filter-tag="${tag}"`), `changelog.html: tag "${tag}" has no filter button`);
  }
}

// Text tokens must clear AA on every surface they appear on. axe can't measure
// text over the body's gradient, so this covers the brightest part of the glow.
const css = read('css/style.css');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))[1];
const luminance = (hex) => {
  const channel = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const linear = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(channel(1)) + 0.7152 * linear(channel(3)) + 0.0722 * linear(channel(5));
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = ['bg', 'bg-tint', 'bg-raised', 'bg-panel', 'bg-panel-alt'];
for (const text of ['text', 'text-muted', 'text-faint', 'gold-bright', 'blood-bright', 'gold']) {
  for (const surface of surfaces) {
    const ratio = contrast(token(text), token(surface));
    check(ratio >= 4.5, `--${text} on --${surface} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
  }
}
for (const surface of surfaces) {
  const ratio = contrast(token('border-strong'), token(surface));
  check(ratio >= 3, `--border-strong on --${surface} is ${ratio.toFixed(2)}:1, needs 3:1`);
}
check(contrast('#ffffff', token('blood')) >= 4.5, 'white on --blood needs 4.5:1');
check(contrast('#ffffff', token('blood-deep')) >= 4.5, 'white on --blood-deep needs 4.5:1');
check(contrast(token('text'), token('blood-deep')) >= 4.5, '--text on --blood-deep needs 4.5:1');
check(contrast('#1a0f11', token('gold-bright')) >= 4.5, 'dark text on --gold-bright needs 4.5:1');

if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`✓ site checks passed (${pages.length} pages, ${entries.length} changelog entries)`);
