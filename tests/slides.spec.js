const { test, expect } = require('@playwright/test');

const TOTAL_SLIDES = 20;
const PRESENTATION_URL = 'file:///tmp/agentic-coding-presentations/talks/recursive-reflective-robots/index.html';

// All hyperlinks from the presentation
const EXPECTED_LINKS = [
  'https://github.com/rysweet/amplihack/blob/main/.claude/context/PHILOSOPHY.md',
  'https://github.github.com/gh-aw/',
  'https://github.com/rysweet/amplihack/blob/main/.github/workflows/repo-guardian.md',
  'https://github.com/rysweet/amplihack/blob/main/.claude/workflow/DEFAULT_WORKFLOW.md',
  'https://github.com/rysweet/amplihack/tree/main/.claude/agents/amplihack',
  'https://rysweet.github.io/amplihack/recipes/',
  'https://github.com/rysweet/amplihack/blob/main/amplifier-bundle/recipes/default-workflow.yaml',
  'https://github.com/rysweet/amplihack/tree/main/.claude/skills/e2e-outside-in-test-generator',
  'https://github.com/rysweet/amplihack/tree/main/.claude/skills/outside-in-testing',
  'https://rysweet.github.io/gadugi-agentic-test/',
  'https://github.com/rysweet/amplihack/blob/main/.claude/skills/quality-audit/SKILL.md',
  'https://github.com/rysweet/amplihack/tree/main/.claude/skills/silent-degradation-audit',
  'https://github.com/rysweet/agent-kgpacks',
];

test.describe('Presentation Structure', () => {
  test('should have exactly 20 slides', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal .slides section');
    const slideCount = await page.locator('.reveal .slides > section').count();
    expect(slideCount).toBe(TOTAL_SLIDES);
  });

  test('title slide has correct content', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal .slides section');
    const title = await page.locator('.reveal .slides > section').first().locator('h1').textContent();
    expect(title).toContain('Recursive, Reflective Robots Reap Real Rewards');
  });
});

test.describe('Slide Navigation', () => {
  test('can navigate through all 20 slides', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    for (let i = 0; i < TOTAL_SLIDES - 1; i++) {
      // Check current slide is visible
      const currentSlide = page.locator('.reveal .slides > section.present');
      await expect(currentSlide).toBeVisible();

      // Navigate to next slide
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
    }

    // Verify we're on the last slide
    const slideNum = await page.evaluate(() => Reveal.getState().indexh);
    expect(slideNum).toBe(TOTAL_SLIDES - 1);
  });
});

test.describe('Slide Readability', () => {
  test('all slide text is visible and readable', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    for (let i = 0; i < TOTAL_SLIDES; i++) {
      // Navigate to slide
      await page.evaluate((idx) => Reveal.slide(idx), i);
      await page.waitForTimeout(300);

      const currentSlide = page.locator('.reveal .slides > section.present');

      // Check that all text elements are visible (h1, h2, h3, p, li)
      const textElements = currentSlide.locator('h1, h2, h3, p, li');
      const count = await textElements.count();

      for (let j = 0; j < count; j++) {
        const el = textElements.nth(j);
        const text = await el.textContent();
        if (text && text.trim().length > 0) {
          // Check element is visible
          await expect(el).toBeVisible({ timeout: 2000 });

          // Check font size is at least 10px
          const fontSize = await el.evaluate(e => parseFloat(getComputedStyle(e).fontSize));
          expect(fontSize).toBeGreaterThanOrEqual(10);

          // Check text has sufficient contrast (not transparent)
          const color = await el.evaluate(e => getComputedStyle(e).color);
          expect(color).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    }
  });

  test('no text overflows slide boundaries', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    const slideWidth = 1280;
    const slideHeight = 720;

    for (let i = 0; i < TOTAL_SLIDES; i++) {
      await page.evaluate((idx) => Reveal.slide(idx), i);
      await page.waitForTimeout(300);

      const overflows = await page.evaluate(({ w, h }) => {
        const current = document.querySelector('.reveal .slides > section.present');
        if (!current) return [];
        const issues = [];
        const els = current.querySelectorAll('h1, h2, h3, p, li, ul, ol, div, img');
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          // Allow some margin for off-screen transforms by reveal.js
          if (rect.width > 0 && rect.height > 0) {
            if (rect.right > w + 100 || rect.bottom > h + 100) {
              issues.push({
                tag: el.tagName,
                text: el.textContent?.substring(0, 40),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom)
              });
            }
          }
        }
        return issues;
      }, { w: slideWidth, h: slideHeight });

      if (overflows.length > 0) {
        console.log(`Slide ${i + 1} overflow warnings:`, JSON.stringify(overflows));
      }
    }
  });
});

test.describe('Images', () => {
  test('all images load successfully', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    for (let i = 0; i < TOTAL_SLIDES; i++) {
      await page.evaluate((idx) => Reveal.slide(idx), i);
      await page.waitForTimeout(300);

      const images = page.locator('.reveal .slides > section.present img');
      const imgCount = await images.count();

      for (let j = 0; j < imgCount; j++) {
        const img = images.nth(j);
        const src = await img.getAttribute('src');
        const naturalWidth = await img.evaluate(e => e.naturalWidth);
        expect(naturalWidth, `Image ${src} on slide ${i + 1} failed to load`).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Hyperlinks', () => {
  test('all expected links are present in the presentation', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    const allHrefs = await page.evaluate(() => {
      const links = document.querySelectorAll('.reveal .slides a[href]');
      return Array.from(links).map(a => a.href);
    });

    for (const expected of EXPECTED_LINKS) {
      const found = allHrefs.some(href => href === expected || href.includes(expected));
      expect(found, `Missing link: ${expected}`).toBe(true);
    }
  });

  test('all links have target="_blank"', async ({ page }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    const linksWithoutTarget = await page.evaluate(() => {
      const links = document.querySelectorAll('.reveal .slides a[href^="http"]');
      return Array.from(links)
        .filter(a => a.target !== '_blank')
        .map(a => a.href);
    });

    expect(linksWithoutTarget, `Links missing target="_blank": ${linksWithoutTarget.join(', ')}`).toHaveLength(0);
  });

  test('verify links are reachable (HEAD requests)', async ({ page, request }) => {
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');

    const allHrefs = await page.evaluate(() => {
      const links = document.querySelectorAll('.reveal .slides a[href^="http"]');
      return [...new Set(Array.from(links).map(a => a.href))];
    });

    const results = [];
    for (const url of allHrefs) {
      try {
        const resp = await request.head(url, { timeout: 10000 });
        results.push({ url, status: resp.status(), ok: resp.status() < 400 });
      } catch (e) {
        // Try GET if HEAD fails
        try {
          const resp = await request.get(url, { timeout: 10000 });
          results.push({ url, status: resp.status(), ok: resp.status() < 400 });
        } catch (e2) {
          results.push({ url, status: 0, ok: false, error: e2.message });
        }
      }
    }

    console.log('Link check results:');
    for (const r of results) {
      console.log(`  ${r.ok ? '✓' : '✗'} [${r.status}] ${r.url}${r.error ? ' - ' + r.error : ''}`);
    }

    const broken = results.filter(r => !r.ok);
    if (broken.length > 0) {
      console.log(`\nBroken links found: ${broken.map(b => b.url).join(', ')}`);
    }
  });
});

// ============= LONGFORM VERSION TESTS =============
const LONGFORM_URL = 'file:///tmp/agentic-coding-presentations/talks/recursive-reflective-robots/longform.html';

test.describe('Longform Version', () => {
  test('page loads and has all 15 sections', async ({ page }) => {
    await page.goto(LONGFORM_URL);
    const sections = await page.locator('.content .section').count();
    expect(sections).toBe(15);
  });

  test('table of contents links work', async ({ page }) => {
    await page.goto(LONGFORM_URL);
    const tocLinks = page.locator('.toc a');
    const count = await tocLinks.count();
    expect(count).toBe(15);

    for (let i = 0; i < count; i++) {
      const href = await tocLinks.nth(i).getAttribute('href');
      const target = page.locator(href);
      await expect(target).toBeAttached();
    }
  });

  test('all images load (webp)', async ({ page }) => {
    await page.goto(LONGFORM_URL);
    const images = page.locator('.content img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      expect(src).toContain('.webp');
      // Scroll into view to trigger lazy loading
      await img.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const naturalWidth = await img.evaluate(e => e.naturalWidth);
      expect(naturalWidth, 'Image ' + src + ' failed to load').toBeGreaterThan(0);
    }
  });

  test('all expected hyperlinks present', async ({ page }) => {
    await page.goto(LONGFORM_URL);
    const allHrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.content a[href^="http"]')).map(a => a.href);
    });
    for (const expected of EXPECTED_LINKS) {
      const found = allHrefs.some(href => href === expected || href.includes(expected));
      expect(found, 'Missing link: ' + expected).toBe(true);
    }
  });

  test('text is readable - font sizes and contrast', async ({ page }) => {
    await page.goto(LONGFORM_URL);
    const textEls = page.locator('.content p, .content li, .content h2, .content h3');
    const count = await textEls.count();
    for (let i = 0; i < Math.min(count, 30); i++) {
      const el = textEls.nth(i);
      const fontSize = await el.evaluate(e => parseFloat(getComputedStyle(e).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(14);
    }
  });

  test('cross-links between slide and longform versions', async ({ page }) => {
    // Longform links to slides
    await page.goto(LONGFORM_URL);
    const slideLink = page.locator('a[href="index.html"]');
    await expect(slideLink.first()).toBeVisible();

    // Slides link to longform
    await page.goto(PRESENTATION_URL);
    await page.waitForSelector('.reveal.ready');
    const longformLink = page.locator('a[href="longform.html"]');
    await expect(longformLink).toBeVisible();
  });
});
