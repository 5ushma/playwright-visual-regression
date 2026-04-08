import { Page } from '@playwright/test';

/**
 * Waits until the page DOM has been mutation-free for `quietMs` milliseconds.
 * This is more reliable than fixed waits for pages with complex loading states.
 *
 * Algorithm:
 * 1. Attach a MutationObserver that resets a timer on every DOM change.
 * 2. Resolve when the timer fires without being reset.
 * 3. Detach the observer after resolution.
 */
export async function waitForStable(
  page: Page,
  quietMs = 500,
  timeoutMs = 15_000
): Promise<void> {
  await page
    .evaluate(
      ({ quiet, timeout }) =>
        new Promise<void>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout>;

          const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(done, quiet);
          };

          const done = () => {
            observer.disconnect();
            resolve();
          };

          const observer = new MutationObserver(reset);
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });

          // Start the initial timer
          timer = setTimeout(done, quiet);

          // Global timeout to avoid hanging
          setTimeout(() => {
            observer.disconnect();
            reject(
              new Error(
                `Page did not stabilise within ${timeout}ms`
              )
            );
          }, timeout);
        }),
      { quiet: quietMs, timeout: timeoutMs }
    )
    .catch((err: Error) => {
      // Stability timeout is not fatal; log and continue
      console.warn(`[visual-regression] ${err.message}`);
    });
}

/**
 * Waits until no network requests are in flight for `quietMs` ms.
 * Complements waitForStable for API-heavy applications.
 */
export async function waitForNetworkQuiet(
  page: Page,
  quietMs = 500
): Promise<void> {
  let inFlight = 0;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  let resolver: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    resolver = resolve;
  });

  const checkQuiet = () => {
    if (inFlight === 0) {
      quietTimer = setTimeout(() => resolver?.(), quietMs);
    }
  };

  const onRequest = () => {
    inFlight++;
    if (quietTimer) {
      clearTimeout(quietTimer);
      quietTimer = null;
    }
  };

  const onResponse = () => {
    inFlight = Math.max(0, inFlight - 1);
    checkQuiet();
  };

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onResponse);

  checkQuiet();

  await promise;

  page.off('request', onRequest);
  page.off('response', onResponse);
  page.off('requestfailed', onResponse);
}

/**
 * Waits for all CSS animations and transitions on the page to complete.
 * Uses the Web Animations API where available, falls back to fixed wait.
 */
export async function waitForAnimations(
  page: Page,
  timeoutMs = 5_000
): Promise<void> {
  await page
    .evaluate(
      (timeout) =>
        new Promise<void>((resolve) => {
          const check = () => {
            const animations = document.getAnimations?.() ?? [];
            if (animations.length === 0) {
              resolve();
              return;
            }
            Promise.all(animations.map((a) => a.finished))
              .then(() => resolve())
              .catch(() => resolve()); // Cancelled animations should not block
          };

          check();
          setTimeout(resolve, timeout); // Fallback timeout
        }),
      timeoutMs
    )
    .catch(() => {/* ignore */});
}

/**
 * Checks if a locator is within the viewport, optionally scrolling it into view.
 */
export async function scrollIntoViewIfNeeded(
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await waitForStable(page, 200);
}