import { Page } from '@playwright/test';

/**
 * Applies page-level preparations to ensure consistent visual rendering
 * across environments. Called automatically by the visual fixture.
 */
export async function preparePageForSnapshot(page: Page): Promise<void> {
  // Inject CSS that smooths out render inconsistencies across platforms
  await page.addStyleTag({
    content: `
      /* Prevent font rendering differences across OS */
      *, *::before, *::after {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }

      /* Hide scrollbars which can vary by OS */
      ::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; }

      /* Prevent caret blinking in inputs */
      input, textarea, [contenteditable] {
        caret-color: transparent !important;
      }

      /* Normalise focus outlines */
      :focus-visible {
        outline: 2px solid #0070f3 !important;
        outline-offset: 2px !important;
      }
    `,
  });

  // Set a fixed viewport scroll position
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/**
 * Disables all animations and transitions on the page.
 * More thorough than Playwright's built-in `animations: 'disabled'`.
 */
export async function disableAllAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0.001ms !important;
        animation-delay: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition: none !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0.001ms !important;
      }
    `,
  });

  // Also pause Web Animations API
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.pause());
  });
}

/**
 * Scrolls the entire page to trigger lazy-loaded content before capture.
 * Useful for long pages with intersection-observer-based loading.
 */
export async function triggerLazyLoad(
  page: Page,
  scrollStep = 200
): Promise<void> {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  let scrolled = 0;

  while (scrolled < totalHeight) {
    await page.evaluate((y) => window.scrollTo(0, y), scrolled);
    scrolled += scrollStep;
    await page.waitForTimeout(50);
  }

  // Return to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

/**
 * Sets up console error monitoring. Collect all console errors during
 * a visual test to surface JS failures that might cause rendering issues.
 */
export function monitorConsoleErrors(
  page: Page
): { errors: string[]; clear: () => void } {
  const errors: string[] = [];

  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  };

  page.on('console', handler);

  return {
    errors,
    clear: () => page.off('console', handler),
  };
}

/**
 * Emulates reduced-motion preference for testing
 * accessibility-minded animation fallbacks.
 */
export async function emulateReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/**
 * Simulates a slow network connection to test loading states.
 */
export async function emulateSlowNetwork(
  page: Page,
  profile: 'slow3g' | 'fast3g' | 'offline' = 'slow3g'
): Promise<void> {
  const profiles = {
    slow3g: { download: 400_000, upload: 400_000, latency: 400 },
    fast3g: { download: 1_500_000, upload: 750_000, latency: 40 },
    offline: { download: 0, upload: 0, latency: 0 },
  };

  const context = page.context();
  await context.setOffline(profile === 'offline');

  if (profile !== 'offline') {
    // Note: CDPSession throttling requires Chromium
    try {
      const client = await context.newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: profiles[profile].latency,
        downloadThroughput: profiles[profile].download,
        uploadThroughput: profiles[profile].upload,
      });
    } catch {
      console.warn('[visual-regression] Network throttling requires Chromium');
    }
  }
}