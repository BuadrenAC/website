# Buadren AC Website

Source for [www.buadren.com](https://www.buadren.com/), the website for **Buadren AC**, a small,
community-run Asheron's Call PvE server running on [ACE](https://github.com/ACEmulator/ACE).

- **Server:** `gs1.buadren.com:9000`
- **Discord:** <https://discord.gg/yMkzW3yAd4>
- **Server stats:** <https://treestats.net/Buadren%20AC>

## Layout

It's a plain static site: no build step, no framework, no dependencies.

```
docs/
├── index.html       # Home: about, highlights, latest changelog entries
├── play.html        # How to install the client and connect
├── changelog.html   # Full history of server changes
├── css/style.css    # All styling; colors and fonts are tokens in :root
├── js/script.js     # Mobile nav toggle and footer year
├── img/             # Discord icon (logo/favicon), Radiant Blood banner (hero), og-banner.png (social previews)
└── CNAME            # Custom domain for GitHub Pages
```

## Theme

The site uses the **Radiant Blood** society look, matching our Discord: crimson banner cloth,
gold trim, and the blood-drop sigil. The palette lives in the `:root` block at the top of
`docs/css/style.css` (`--blood*`, `--gold*`, `--bg*`, `--text*`). Change colors there, not in
individual rules.

## Social previews

Links shared on Discord, Facebook, X, etc. show `docs/img/og-banner.png` (1200×630) through the
Open Graph / Twitter tags in each page's `<head>`. The embed accent color comes from the
`theme-color` meta tag.

To change the banner (for example, if the server address changes), edit
`social/og-banner.html`, open it in a browser at exactly 1200×630, screenshot it, and save the
result over `docs/img/og-banner.png`. Discord caches embeds, so an old preview may stick around for
a while after you change it.

## Previewing locally

Serve the `docs/` folder with any static file server, e.g.:

```bash
python3 -m http.server 8000 --directory docs
```

Then open <http://localhost:8000>.

## Common edits

- **New changelog entry:** add a `changelog-entry` block at the top of the list in
  `changelog.html`. If it's worth featuring, also update the "Latest from the changelog" teaser
  in `index.html`.
- **Connection details:** the server address appears in `index.html` (hero and "At a glance"),
  `play.html`, and the social banner. Update all of them.
- **Nav/footer:** these are copied into each page by hand. Update all three HTML files.

## Deployment

GitHub Pages serves `docs/` from the `main` branch at `www.buadren.com`. Anything merged to `main`
goes live automatically within a minute or two.

## Disclaimer

Asheron's Call was a registered trademark of Turbine, Inc. and WB Games Inc. Buadren AC is not
associated or affiliated in any way with Turbine, Inc. or WB Games Inc. The Radiant Blood
artwork in `docs/img/` comes from Asheron's Call and belongs to its respective owners.
