import { test as base, expect, Page } from '@playwright/test';

type VisualSnapshotOptions = {
  fullPage?: boolean;
  mask?: string[];
  threshold?: number;
  maxDiffPixelRatio?: number;
};

type VisualPage = Page & {
  gotoStable: (url: string) => Promise<void>;
  freezeAnimations: () => Promise<void>;
  visualSnapshot: (name: string, options?: VisualSnapshotOptions) => Promise<void>;
};

type VisualFixtureOptions = {
  visualThreshold: number;
  captureInteractionStates: boolean;
  maskDynamicContent: boolean;
  dynamicContentSelectors: string[];
  waitForNetworkIdle: boolean;
  stableTimeout: number;
};

export const test = base.extend<{
  visualPage: VisualPage;
} & VisualFixtureOptions>({
  visualThreshold: [0.01, { option: true }],
  captureInteractionStates: [true, { option: true }],
  maskDynamicContent: [true, { option: true }],
  dynamicContentSelectors: [
    ['[data-testid="timestamp"]', '[data-testid="date"]', '.skeleton-loader', '[aria-busy="true"]'],
    { option: true }
  ],
  waitForNetworkIdle: [true, { option: true }],
  stableTimeout: [500, { option: true }],

  visualPage: async (
    { page, dynamicContentSelectors, waitForNetworkIdle, stableTimeout, visualThreshold },
    use
  ) => {
    const vPage = page as VisualPage;

    vPage.gotoStable = async (url: string) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (waitForNetworkIdle) {
        await page.waitForLoadState('networkidle').catch(() => {});
      }

      await page.waitForTimeout(stableTimeout);
    };

    vPage.freezeAnimations = async () => {
      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }
        `
      });
    };

    vPage.visualSnapshot = async (name: string, options: VisualSnapshotOptions = {}) => {
      await vPage.freezeAnimations();

      if (waitForNetworkIdle) {
        await page.waitForLoadState('networkidle').catch(() => {});
      }

      await page.waitForTimeout(stableTimeout);

      const maskLocators =
        options.mask?.map((selector) => page.locator(selector)) ??
        dynamicContentSelectors.map((selector) => page.locator(selector));

      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: options.fullPage ?? true,
        mask: maskLocators,
        threshold: options.threshold ?? visualThreshold,
        maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.01,
        animations: 'disabled'
      });
    };

    await use(vPage);
  }
});

export { expect };
