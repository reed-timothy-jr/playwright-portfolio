import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';
import {
	auditAccessibility,
	blockers,
	checkFormLabels,
	checkKeyboardNavigation,
} from '../../src/support/a11y';

/**
 * Supporting suite: accessibility — full module coverage against the
 * fixture app. Where login.a11y.spec.ts runs one raw axe scan, these
 * specs exercise src/support/a11y.ts end to end: the full audit, the
 * keyboard Tab-walk, and the form-label inventory. Same severity bar as
 * the rest of the suite: critical/serious findings fail the build.
 */
test.describe('accessibility — full module (fixture app)', () => {
	test('login page passes the full audit with no blockers', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/login`);

		const audit = await auditAccessibility(page);

		expect(blockers(audit.violations)).toEqual([]);
		expect(audit.altText.unnamed).toEqual([]);
		expect(audit.formLabels.unlabeled).toEqual([]);
	});

	test('secure area passes the full audit with no blockers', async ({
		page,
		appTarget,
	}) => {
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'SuperSecretPassword!');
		await expect(page).toHaveURL(/\/secure$/);

		const audit = await auditAccessibility(page);

		expect(blockers(audit.violations)).toEqual([]);
	});

	test('keyboard tab order reaches username, password, and submit', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/login`);

		const keyboard = await checkKeyboardNavigation(page);
		const selectors = keyboard.stops.map((s) => s.selector);

		expect(selectors).toContain('#username');
		expect(selectors).toContain('#password');
		// The submit button is the only button on the form.
		const submitStop = keyboard.stops.find((s) => s.role === 'button');
		expect(submitStop?.text).toBe('Login');
		expect(keyboard.reachedMainContent).toBe(true);
		expect(
			keyboard.findings.filter((f) => f.kind !== 'invisible-focus'),
		).toEqual([]);
	});

	test('every form control on the login page has an accessible name', async ({
		page,
		appTarget,
	}) => {
		await page.goto(`${appTarget.url}/login`);

		const labels = await checkFormLabels(page);

		expect(labels.controls.length).toBeGreaterThanOrEqual(3);
		expect(labels.unlabeled).toEqual([]);
		expect(blockers(labels.violations)).toEqual([]);
		const bySelector = new Map(labels.controls.map((c) => [c.selector, c]));
		expect(bySelector.get('#username')?.nameSource).toBe('label');
		expect(bySelector.get('#password')?.nameSource).toBe('label');
	});
});
