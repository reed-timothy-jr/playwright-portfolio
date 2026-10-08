import { expect, test } from '../../src/fixtures';

/**
 * Visual regression — deterministic by design.
 *
 * The spec renders a fixed fixture page (no network, no timestamps, no
 * animations). Baselines are platform-specific (font rendering differs
 * between Linux/macOS/Windows): generate them per platform with
 * `npx playwright test --project=visual --update-snapshots`, and keep the
 * committed baseline for the platform CI runs on. This spec is the pattern
 * for component/fixture-level visual testing. For full-page coverage of
 * your own app, add specs that navigate to real pages and generate
 * baselines per environment the same way.
 */
const LOGIN_CARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Login</title>
<style>
  * { box-sizing: border-box; margin: 0; font-family: Arial, sans-serif; }
  body { background: #f4f5f7; display: flex; justify-content: center; padding-top: 80px; }
  .card { background: #fff; border: 1px solid #dfe1e6; border-radius: 8px; padding: 32px; width: 360px; }
  h1 { font-size: 20px; margin-bottom: 16px; color: #172b4d; }
  label { display: block; font-size: 13px; color: #5e6c84; margin: 12px 0 4px; }
  input { width: 100%; padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; }
  button { width: 100%; margin-top: 16px; padding: 10px; background: #0052cc; color: #fff; border: 0; border-radius: 4px; font-size: 14px; }
</style></head>
<body><div class="card">
  <h1>Sign in</h1>
  <label for="username">Username</label><input id="username" value="tomsmith">
  <label for="password">Password</label><input id="password" type="password" value="••••••••">
  <button type="submit">Login</button>
</div></body></html>`;

test.describe('visual regression', () => {
	test('login card matches baseline', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.setContent(LOGIN_CARD_HTML);
		await expect(page).toHaveScreenshot('login-card.png', {
			animations: 'disabled',
			maxDiffPixelRatio: 0.01,
		});
	});
});
