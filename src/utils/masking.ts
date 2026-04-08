import { Locator, Page } from '@playwright/test';

/**
 * Common patterns for auto-detecting dynamic content that should be masked.
 * Add application-specific patterns as needed.
 */
export const DYNAMIC_PATTERNS = {
  timestamps: [
    '[data-testid*="timestamp"]',
    '[data-testid*="date"]',
    '[data-testid*="time"]',
    'time[datetime]',
    '.timestamp',
    '.date-display',
    '.relative-time',
  ],
  loading: [
    '.skeleton',
    '.skeleton-loader',
    '[aria-busy="true"]',
    '.loading-placeholder',
    '[data-loading="true"]',
  ],
  userContent: [
    '[data-testid="avatar"]',
    '.user-avatar',
    '.profile-photo',
  ],
  thirdParty: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="stripe"]',
    '[data-testid="ad-slot"]',
    '.third-party-widget',
  ],
  charts: [
    // Charts with time-series data are dynamic by nature
    '[data-testid*="live-chart"]',
    '.recharts-line-curve', // Recharts
    '.apexcharts-series', // ApexCharts
  ],
} as const;

/**
 * Returns an array of locators for all known dynamic regions.
 * These are passed to `mask` in Playwright screenshot options.
 */
export function maskDynamicRegions(
  page: Page,
  extraSelectors: string[] = []
): Locator[] {
  const allSelectors = [
    ...Object.values(DYNAMIC_PATTERNS).flat(),
    ...extraSelectors,
  ];

  return allSelectors.map((selector) => page.locator(selector));
}

/**
 * Freezes date/time-related content in the DOM to a fixed value.
 * This is an alternative to masking — useful when you want to see
 * the timestamp format, just not have it change between runs.
 */
export async function freezeTimestamps(
  page: Page,
  fixedDate = '2024-01-15T10:00:00.000Z'
): Promise<void> {
  await page.addInitScript((date) => {
    // Override Date globally for consistent timestamp rendering
    const _OriginalDate = Date;
    const fixedTime = new _OriginalDate(date).getTime();

    // @ts-ignore — overriding global Date for testing
    Date = class MockDate extends _OriginalDate {
      constructor(...args: ConstructorParameters<typeof _OriginalDate>) {
        if (args.length === 0) {
          super(fixedTime);
        } else {
          // @ts-ignore
          super(...args);
        }
      }

      static now() {
        return fixedTime;
      }
    };
  }, fixedDate);
}

/**
 * Replaces image src attributes with a stable placeholder.
 * Prevents user-generated image URLs or CDN content from causing flakiness.
 */
export async function stabilizeImages(
  page: Page,
  selectors: string[] = ['img[src*="blob:"]', 'img[src*="data:"]']
): Promise<void> {
  for (const selector of selectors) {
    await page.evaluate((sel) => {
      document.querySelectorAll<HTMLImageElement>(sel).forEach((img) => {
        img.setAttribute('data-original-src', img.src);
        // Replace with a 1x1 transparent PNG
        img.src =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      });
    }, selector);
  }
}

/**
 * Returns the bounding boxes of all matched elements, useful for
 * programmatically building clip regions.
 */
export async function getBoundingBoxes(
  page: Page,
  selector: string
): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  return page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
  }, selector);
}