/**
 * Extended options for visual regression testing.
 * Merged into Playwright's base options via generic parameter.
 */
export interface VisualTestOptions {
  /** Directory where approved snapshots are stored */
  snapshotDir: string;

  /** Directory for new/unapproved snapshots awaiting review */
  pendingDir: string;

  /** Directory for diff images generated on failures */
  diffDir: string;

  /**
   * Pixel-level threshold for visual comparison (0 = exact, 1 = fully different).
   * Applied globally; individual assertions can override.
   */
  visualThreshold: number;

  /**
   * When true, captures screenshots after each defined interaction
   * (hover, focus, active, open states) automatically.
   */
  captureInteractionStates: boolean;

  /**
   * When true, masks dynamic content (dates, timestamps, loaders)
   * before comparison to avoid flaky failures.
   */
  maskDynamicContent: boolean;

  /**
   * CSS selectors for content that changes between runs.
   * These regions are blacked out before pixel comparison.
   */
  dynamicContentSelectors: string[];

  /**
   * Wait for network to reach idle state before taking screenshots.
   * Prevents captures mid-fetch.
   */
  waitForNetworkIdle: boolean;

  /**
   * Milliseconds to wait after last DOM mutation before capturing.
   * Helps with CSS transitions and animations settling.
   */
  stableTimeout: number;
}

/**
 * Configuration for a single component's visual regression test.
 */
export interface ComponentTestConfig {
  name: string;
  url: string;
  selector?: string;
  states?: ComponentState[];
  viewports?: Array<{ width: number; height: number }>;
  threshold?: number;
  mask?: string[];
}

/**
 * Describes an interactive state to capture for a component.
 */
export interface ComponentState {
  name: string;
  setup: (page: import('@playwright/test').Page) => Promise<void>;
  teardown?: (page: import('@playwright/test').Page) => Promise<void>;
}

/**
 * Result of a single visual comparison.
 */
export interface VisualComparisonResult {
  passed: boolean;
  snapshotName: string;
  diffPixels?: number;
  diffRatio?: number;
  baselinePath?: string;
  actualPath?: string;
  diffPath?: string;
  error?: string;
}