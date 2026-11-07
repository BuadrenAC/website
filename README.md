# Buadren AC Website

Source for [www.buadren.com](https://www.buadren.com/), the website for **Buadren AC**, a small,
community-run Asheron's Call PvE server running on [ACE](https://github.com/ACEmulator/ACE).

- **Server:** `gs1.buadren.com:9000`
- **Discord:** <https://discord.gg/yMkzW3yAd4>
- **Server stats:** <https://treestats.net/Buadren%20AC>

## Layout

The site is plain static HTML: no build step, no framework, no runtime dependencies. Node is only
used for the checks in `tests/`, and nothing outside `docs/` is published.

```
docs/
├── index.html       # Home: about, highlights, latest changelog entries
├── play.html        # How to install the client and connect
├── changelog.html   # Full history of server changes
├── 404.html         # GitHub Pages serves this for unknown URLs (uses root-relative paths)
├── css/style.css    # All styling; colors and fonts are tokens in :root
├── js/script.js     # Mobile nav, copy buttons, live server status, changelog filters
├── fonts/           # Self-hosted Cinzel and Manrope (SIL OFL)
├── img/             # Logo sizes, Radiant Blood banner, og-banner.jpg (social previews)
├── robots.txt       # Points crawlers at the sitemap
├── sitemap.xml      # Add new pages here
├── .nojekyll        # Serve files as-is instead of running them through Jekyll
└── CNAME            # Custom domain for GitHub Pages
tests/               # Link checks, site rules, and browser/accessibility tests
social/              # Source for the social preview banner
```

## Theme

The site uses the **Radiant Blood** society look, matching our Discord: crimson banner cloth,
gold trim, and the blood-drop sigil. The palette lives in the `:root` block at the top of
`docs/css/style.css` (`--blood*`, `--gold*`, `--bg*`, `--text*`). Change colors there, not in
individual rules. `npm run test:site` fails if a text color drops below WCAG AA contrast.

## Social previews

Links shared on Discord, Facebook, X, etc. show `docs/img/og-banner.jpg` (1200×630) through the
Open Graph / Twitter tags in each page's `<head>`. The embed accent color comes from the
`theme-color` meta tag.

To change the banner (for example, if the server address changes), edit
`social/og-banner.html`, open it in a browser at exactly 1200×630, screenshot it, and save the
result over `docs/img/og-banner.jpg`. Discord caches embeds, so an old preview may stick around for
a while after you change it.

## Previewing locally

Serve the `docs/` folder with any static file server, e.g.:

```bash
python3 -m http.server 8000 --directory docs
```

Then open <http://localhost:8000>.

## Checks

```bash
npm ci
npx playwright install chromium
npm test
```

| Command | What it checks |
|---|---|
| `npm run test:html` | HTML validity and accessibility rules |
| `npm run test:site` | Nav and footer match across pages, teasers match the changelog, color contrast |
| `npm run test:links` | Every internal link and `#fragment` resolves |
| `npm run test:e2e` | axe (WCAG 2.2 AA) at desktop and mobile, keyboard use, no-JS fallbacks, 320px reflow, status widget, filters |
| `npm run test:links:external` | External URLs. CI runs this weekly, because dead links don't come with a commit |

CI runs all but the external check on every pull request. Dependabot keeps the actions (pinned to
commit SHAs) and the dev tools up to date.

## Common edits

- **New changelog entry:** add an `<article class="changelog-entry">` at the top of the right year
  in `changelog.html`, with a unique `id`, its `data-tags`, and the matching topics list. Then move
  the three teasers in `index.html` along, since `npm run test:site` checks they match the top
  three entries.
- **Connection details:** the server address appears in `index.html` (hero and "At a glance"),
  `play.html` (step 3 and "Quick reference"), and the social banner. Update all of them, including
  each copy button's `data-copy`.
- **Nav/footer:** these are copied into each page by hand. Update all four HTML files;
  `npm run test:site` fails if they drift. `404.html` keeps its own copy with root-relative paths.
- **Server status:** the badge reads the [TreeStats monitor](https://servers.treestats.net/) API
  from the visitor's browser. If you change the API host, update `connect-src` in each page's
  Content-Security-Policy meta tag.

## Deployment

GitHub Pages serves `docs/` from the `main` branch at `www.buadren.com`. Anything merged to `main`
goes live automatically within a minute or two. Changes reach `main` through pull requests, and the
three CI checks have to pass first.

## License

The site's code (HTML structure, CSS, JavaScript, tests, and tooling) is under the
[MIT License](LICENSE). That doesn't cover:

- **Written content** such as the changelog and page copy: all rights reserved by Buadren AC.
- **Artwork and logos** in `docs/img/`: see the disclaimer below.
- **Fonts** in `docs/fonts/`: SIL Open Font License, with each license alongside its font.

## Disclaimer

Asheron's Call was a registered trademark of Turbine, Inc. and WB Games Inc. Buadren AC is not
associated or affiliated in any way with Turbine, Inc. or WB Games Inc. The Radiant Blood
artwork in `docs/img/` comes from Asheron's Call and belongs to its respective owners.
