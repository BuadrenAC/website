import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/index.html', '/play.html', '/changelog.html', '/does-not-exist'];
const STATUS_API = 'https://servers.treestats.net/api/statuses/**';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const statusBody = (status, ageMs = 60_000) => ({
  contentType: 'application/json',
  body: JSON.stringify({
    statuses: [{ status, created_at: new Date(Date.now() - ageMs).toISOString() }],
  }),
});

// Never depend on the real server or the real monitor in tests.
test.beforeEach(async ({ page }) => {
  await page.route(STATUS_API, (route) => route.fulfill(statusBody('UP')));
});

async function expectNoViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
  expect(summary).toEqual([]);

  // Contrast axe couldn't measure is a silent pass unless we look at it.
  const unmeasured = results.incomplete
    .filter((item) => item.id === 'color-contrast')
    .flatMap((item) => item.nodes.map((node) => node.target.join(' ')))
    // Cells scrolled out of the table's overflow region; the desktop run measures them.
    .filter((target) => !/^tr:|^#spell-table-caption/.test(target));
  expect(unmeasured).toEqual([]);
}

// axe gives up on contrast over gradients and pseudo-elements. Remove the
// decoration so it measures the text; site-checks.mjs covers the glow itself.
async function flattenDecoration(page) {
  await page.addStyleTag({ content: 'body { background-image: none; } .steps::before { display: none; }' });
}

for (const path of PAGES) {
  test.describe(`${path}`, () => {
    test.describe('axe', () => {
      test.use({ bypassCSP: true });

      test('has no violations on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(path);
        await flattenDecoration(page);
        await expectNoViolations(page);
      });

      test('has no violations on mobile with the menu open', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(path);
        await flattenDecoration(page);
        await page.getByRole('button', { name: 'Menu' }).click();
        await expectNoViolations(page);
      });
    });

    test('reflows at 320px with no sideways scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('loads with no console errors or CSP violations', async ({ page }) => {
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(errors).toEqual([]);
    });

    test('keeps focus visible below the sticky header', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 500 });
      await page.goto(path);

      const header = await page.locator('.site-header').boundingBox();
      const count = await page.locator('a[href], button:not([hidden]), input, summary, [tabindex="0"]').count();
      for (let i = 0; i < Math.min(count, 60); i += 1) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (el === document.body || el.closest('.site-header')) return null;
          const box = el.getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            outline: getComputedStyle(el).outlineStyle,
            fixed: el.classList.contains('skip-link'),
          };
        });
        if (!focused || focused.fixed) continue;
        // 2.4.11: not entirely hidden by the header.
        expect(focused.bottom).toBeGreaterThan(header.y + header.height);
        expect(focused.outline).not.toBe('none');
      }
    });
  });
}

test('skip link is the first stop and moves focus to main', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('mobile menu opens, closes on Escape, and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');
  const toggle = page.getByRole('button', { name: 'Menu' });
  const play = page.locator('#nav-links').getByRole('link', { name: 'Play' });

  await expect(play).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(play).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(play).toBeHidden();
  await expect(toggle).toBeFocused();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test('mobile nav is still usable and no dead controls show', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#nav-links').getByRole('link', { name: 'Play' })).toBeVisible();
    await expect(page.locator('.nav-toggle')).toBeHidden();
    await expect(page.locator('.copy-btn')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Check server status' })).toBeVisible();
    await expect(page.locator('.address code')).toHaveText('gs1.buadren.com:9000');
  });

  test('changelog is complete and hides the filters', async ({ page }) => {
    await page.goto('/changelog.html');
    await expect(page.locator('#log-tools')).toBeHidden();
    expect(await page.locator('.changelog-entry:visible').count()).toBeGreaterThan(20);
  });
});

test.describe('server status', () => {
  const pill = (page) => page.locator('[data-server-status]');

  test('shows online', async ({ page }) => {
    await page.goto('/index.html');
    await expect(pill(page)).toHaveAttribute('data-state', 'up');
    await expect(pill(page)).toContainText('Server online');
  });

  test('shows offline', async ({ page }) => {
    await page.route(STATUS_API, (route) => route.fulfill(statusBody('DOWN')));
    await page.goto('/play.html');
    await expect(pill(page)).toHaveAttribute('data-state', 'down');
    await expect(pill(page)).toContainText('Server offline');
  });

  test('does not call a stale reading online', async ({ page }) => {
    await page.route(STATUS_API, (route) => route.fulfill(statusBody('UP', 3 * 60 * 60 * 1000)));
    await page.goto('/index.html');
    await expect(pill(page)).toHaveAttribute('data-state', 'unknown');
    await expect(pill(page)).toContainText('Check server status');
  });

  for (const [name, response] of [
    ['an error', { status: 500, body: 'nope' }],
    ['malformed data', { contentType: 'application/json', body: '{"statuses":[]}' }],
  ]) {
    test(`falls back to a link on ${name}`, async ({ page }) => {
      await page.route(STATUS_API, (route) => route.fulfill(response));
      await page.goto('/index.html');
      await expect(pill(page).getByRole('link', { name: 'Check server status' })).toBeVisible();
    });
  }

  test('falls back to a link when the monitor is unreachable', async ({ page }) => {
    await page.route(STATUS_API, (route) => route.abort());
    await page.goto('/index.html');
    await expect(pill(page).getByRole('link', { name: 'Check server status' })).toBeVisible();
  });
});

test('copy button copies the address and announces it', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/index.html');
  const button = page.getByRole('button', { name: 'Copy server address' });
  await button.click();
  await expect(button).toHaveText('Copied');
  await expect(page.locator('body > [role="status"]')).toContainText('gs1.buadren.com:9000 copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('gs1.buadren.com:9000');
});

test.describe('changelog filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/changelog.html');
  });

  test('narrows by topic and reports the count', async ({ page }) => {
    const total = await page.locator('.changelog-entry').count();
    await page.getByRole('button', { name: 'Fellowships' }).click();
    await expect(page.getByRole('button', { name: 'Fellowships' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#better-fellowship-invites')).toBeVisible();
    await expect(page.locator('#the-enlightenment-update')).toBeHidden();

    const visible = await page.locator('.changelog-entry:visible').count();
    await expect(page.getByRole('status')).toHaveText(`Showing ${visible} of ${total} entries`);

    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('.changelog-entry:visible')).toHaveCount(total);
  });

  test('searches entry text and hides empty years', async ({ page }) => {
    await page.getByLabel('Search entries').fill('Keylore clones');
    await expect(page.locator('.changelog-entry:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: '2025', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2024', level: 2 })).toBeHidden();
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.getByLabel('Search entries').fill('zzzzzz');
    await expect(page.locator('#log-empty')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0');
  });

  test('wide spell table can be scrolled by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const region = page.getByRole('region', { name: /Spell groupings/ });
    await expect(region).toHaveAttribute('tabindex', '0');
    const scrolls = await region.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
  });
});

test('changelog deep links land on the entry, below the header', async ({ page }) => {
  await page.goto('/changelog.html#shadows-of-the-realm');
  const entry = page.locator('#shadows-of-the-realm');
  await expect(entry).toBeInViewport();
  await expect(async () => {
    const box = await entry.boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(box.y).toBeLessThan(300);
  }).toPass();
});

test('unknown URLs get the themed 404 with working assets', async ({ page }) => {
  const response = await page.goto('/some/deep/path');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This portal leads nowhere.');
  const font = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily);
  expect(font).toContain('Cinzel');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
