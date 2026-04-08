import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join('.playwright', 'auth.json');

/**
 * Global setup: runs once before all test projects.
 *
 * This file handles:
 * 1. Authentication (saving cookies / localStorage for reuse)
 * 2. Seeding test data via API
 * 3. Creating required directories
 *
 * The saved auth state is then loaded in all subsequent test projects,
 * avoiding repeated login flows.
 */
setup('authenticate and prepare', async ({ page }) => {
  // ── Create required directories ────────────────────────────────────────────
  for (const dir of [
    '.playwright',
    'snapshots',
    'snapshots-pending',
    'test-results/diffs',
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // ── Authenticate ───────────────────────────────────────────────────────────
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

  // Skip auth if no credentials configured
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    console.log('[setup] No credentials configured, skipping auth');
    // Write empty auth state so dependent projects can start
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  await page.goto(`${baseURL}/login`);

  await page.fill('[name="email"]', process.env.TEST_EMAIL);
  await page.fill('[name="password"]', process.env.TEST_PASSWORD);
  await page.click('[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15_000 });

  // Save auth state (cookies + localStorage) for reuse
  await page.context().storageState({ path: AUTH_FILE });

  console.log('[setup] Auth state saved to', AUTH_FILE);

  // ── Seed test data via API ─────────────────────────────────────────────────
  if (process.env.SEED_API_URL) {
    const response = await page.request.post(process.env.SEED_API_URL, {
      headers: { 'X-Test-Secret': process.env.SEED_SECRET ?? '' },
      data: { scenario: 'visual-regression-baseline' },
    });

    if (!response.ok()) {
      console.warn('[setup] Data seeding failed:', response.status());
    } else {
      console.log('[setup] Test data seeded successfully');
    }
  }
});