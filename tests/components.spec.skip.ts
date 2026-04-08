/**
 * Visual regression tests for core UI components.
 *
 * These tests demonstrate the framework's capabilities:
 * - Full-page snapshots
 * - Component-level isolation
 * - Interactive state capture (hover, focus, active, disabled)
 * - Dark mode / color scheme variants
 * - Responsive breakpoints
 * - Dynamic content masking
 *
 * Tag tests with @visual so they can be run in isolation:
 *   npx playwright test --grep @visual
 */

import { test } from '../src/fixtures/visual-fixture';
import { freezeTimestamps } from '../src/utils/masking';
import { triggerLazyLoad } from '../src/utils/page-prep';

// ─── Button Component ─────────────────────────────────────────────────────────

test.describe('Button @visual', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.gotoStable('/components/button');
    await visualPage.freezeAnimations();
  });

  test('all variants - default state', async ({ visualPage }) => {
    await visualPage.visualSnapshot('button-all-variants');
  });

  test('primary button - all interaction states', async ({ visualPage }) => {
    const button = visualPage.locator('[data-testid="btn-primary"]');

    await visualPage.captureStates('button-primary', [
      {
        name: 'default',
        setup: async () => {
          // Reset any previous hover/focus state
          await visualPage.mouse.move(0, 0);
        },
      },
      {
        name: 'hover',
        setup: async () => button.hover(),
      },
      {
        name: 'focus',
        setup: async () => button.focus(),
      },
      {
        name: 'active',
        setup: async (page) => {
          // Simulate mousedown without releasing to capture active state
          const box = await button.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
          }
        },
      },
    ]);

    // Clean up mousedown
    await visualPage.mouse.up();
  });

  test('disabled state', async ({ visualPage }) => {
    const button = visualPage.locator('[data-testid="btn-primary-disabled"]');
    await visualPage.elementSnapshot(button, 'button-primary-disabled');
  });

  test('loading state', async ({ visualPage }) => {
    await visualPage.locator('[data-testid="btn-trigger-loading"]').click();
    await visualPage.waitForTimeout(50); // Allow loading state to render
    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="btn-primary"]'),
      'button-primary-loading'
    );
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

test.describe('Navigation @visual', () => {
  test('desktop navigation - default', async ({ visualPage }) => {
    await visualPage.gotoStable('/');
    await visualPage.freezeAnimations();

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="main-nav"]'),
      'nav-desktop-default'
    );
  });

  test('desktop navigation - active item', async ({ visualPage }) => {
    await visualPage.gotoStable('/about');
    await visualPage.freezeAnimations();

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="main-nav"]'),
      'nav-desktop-active-about'
    );
  });

  test('mobile navigation - hamburger menu closed', async ({
    visualPage,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await visualPage.gotoStable('/');

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="mobile-nav"]'),
      'nav-mobile-closed'
    );
  });

  test('mobile navigation - menu open', async ({ visualPage, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await visualPage.gotoStable('/');
    await visualPage.locator('[data-testid="hamburger-btn"]').click();
    await visualPage.waitForTimeout(300); // Menu open animation

    await visualPage.visualSnapshot('nav-mobile-open', { fullPage: false });
  });
});

// ─── Form Components ──────────────────────────────────────────────────────────

test.describe('Form @visual', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.gotoStable('/components/forms');
    await visualPage.freezeAnimations();
  });

  test('text input - all states', async ({ visualPage }) => {
    await visualPage.captureStates(
      'input-text',
      [
        {
          name: 'empty',
          setup: async () => {
            await visualPage.locator('[data-testid="input-demo"]').clear();
          },
        },
        {
          name: 'filled',
          setup: async () => {
            await visualPage
              .locator('[data-testid="input-demo"]')
              .fill('Hello world');
          },
        },
        {
          name: 'focused',
          setup: async () => {
            await visualPage.locator('[data-testid="input-demo"]').focus();
          },
        },
        {
          name: 'error',
          setup: async () => {
            await visualPage
              .locator('[data-testid="input-demo-error-trigger"]')
              .click();
          },
        },
        {
          name: 'disabled',
          setup: async () => {
            // Click the "disable" toggle in the demo
          },
        },
      ],
      {
        // Show only the form section
        mask: ['[data-testid="other-form-sections"]'],
      }
    );
  });

  test('form validation - full page', async ({ visualPage }) => {
    // Submit empty form to trigger all validation errors at once
    await visualPage.locator('[data-testid="submit-btn"]').click();
    await visualPage.waitForTimeout(100);

    await visualPage.visualSnapshot('form-validation-errors');
  });

  test('select dropdown - open state', async ({ visualPage }) => {
    const select = visualPage.locator('[data-testid="select-demo"]');
    await select.click();
    await visualPage.waitForTimeout(150); // Dropdown open animation

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="select-dropdown-container"]'),
      'select-open'
    );
  });
});

// ─── Data Table ───────────────────────────────────────────────────────────────

test.describe('Data Table @visual', () => {
  test.beforeEach(async ({ visualPage }) => {
    await freezeTimestamps(visualPage);
    await visualPage.gotoStable('/components/data-table');
    await visualPage.freezeAnimations();
  });

  test('default - empty state', async ({ visualPage }) => {
    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="data-table"]'),
      'table-empty'
    );
  });

  test('default - populated', async ({ visualPage }) => {
    // Load fixture data
    await visualPage.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('load-fixture-data', { detail: { count: 10 } })
      );
    });
    await visualPage.waitForSelector('[data-testid="table-row"]');

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="data-table"]'),
      'table-populated',
      {
        // Mask timestamp columns
        mask: ['[data-col="created_at"]', '[data-col="updated_at"]'],
      }
    );
  });

  test('row hover and selection', async ({ visualPage }) => {
    await visualPage.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('load-fixture-data', { detail: { count: 5 } })
      );
    });

    const firstRow = visualPage.locator('[data-testid="table-row"]').first();
    await firstRow.hover();

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="data-table"]'),
      'table-row-hover'
    );
  });

  test('sorted column', async ({ visualPage }) => {
    await visualPage.locator('[data-col-header="name"]').click();

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="data-table"] thead'),
      'table-header-sorted-asc'
    );

    await visualPage.locator('[data-col-header="name"]').click();

    await visualPage.elementSnapshot(
      visualPage.locator('[data-testid="data-table"] thead'),
      'table-header-sorted-desc'
    );
  });
});

// ─── Modal / Dialog ───────────────────────────────────────────────────────────

test.describe('Modal @visual', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.gotoStable('/components/modal');
    await visualPage.freezeAnimations();
  });

  test('modal - open state', async ({ visualPage }) => {
    await visualPage.locator('[data-testid="open-modal-btn"]').click();
    await visualPage.locator('[role="dialog"]').waitFor({ state: 'visible' });

    // Capture the dialog + backdrop
    await visualPage.visualSnapshot('modal-open', {
      fullPage: false,
      // Mask the page content behind the backdrop for stable comparison
      mask: ['[data-testid="page-content"]'],
    });
  });

  test('confirmation dialog', async ({ visualPage }) => {
    await visualPage.locator('[data-testid="open-confirm-btn"]').click();
    await visualPage.locator('[role="alertdialog"]').waitFor({ state: 'visible' });

    await visualPage.elementSnapshot(
      visualPage.locator('[role="alertdialog"]'),
      'dialog-confirmation'
    );
  });
});

// ─── Dark Mode ────────────────────────────────────────────────────────────────

test.describe('Dark Mode @visual', () => {
  test.use({ colorScheme: 'dark' });

  test('homepage - dark mode', async ({ visualPage }) => {
    await visualPage.gotoStable('/');
    await visualPage.freezeAnimations();
    await visualPage.visualSnapshot('homepage-dark');
  });

  test('component library - dark mode', async ({ visualPage }) => {
    await visualPage.gotoStable('/components');
    await visualPage.freezeAnimations();
    await visualPage.visualSnapshot('components-dark');
  });
});

// ─── Long / Scrollable Page ───────────────────────────────────────────────────

test.describe('Long Page @visual', () => {
  test('landing page - full scroll', async ({ visualPage }) => {
    await visualPage.gotoStable('/landing');
    await visualPage.freezeAnimations();

    // Trigger lazy loaded sections
    await triggerLazyLoad(visualPage);

    await visualPage.visualSnapshot('landing-full-page', { fullPage: true });
  });
});

// ─── Responsive Breakpoints ───────────────────────────────────────────────────

test.describe('Responsive @visual', () => {
  const breakpoints = [
    { name: 'mobile-xs', width: 375, height: 667 },
    { name: 'mobile-lg', width: 428, height: 926 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop-sm', width: 1024, height: 768 },
    { name: 'desktop-lg', width: 1440, height: 900 },
    { name: 'widescreen', width: 1920, height: 1080 },
  ];

  for (const bp of breakpoints) {
    test(`header at ${bp.name} (${bp.width}x${bp.height})`, async ({
      visualPage,
    }) => {
      await visualPage.setViewportSize({
        width: bp.width,
        height: bp.height,
      });
      await visualPage.gotoStable('/');
      await visualPage.freezeAnimations();

      await visualPage.elementSnapshot(
        visualPage.locator('header'),
        `header-${bp.name}`
      );
    });
  }
});