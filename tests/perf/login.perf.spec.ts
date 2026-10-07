import { expect, test } from '../../src/fixtures';
import { attachJson } from '../../src/support/evidence';

/**
 * Performance budgets — Navigation Timing API, no external tooling.
 * Asserts the login page loads within budget and attaches the full
 * timing breakdown as evidence. Budgets come from env so CI can
 * tighten them per environment (PERF_BUDGET_LOAD_MS).
 */
const LOAD_BUDGET_MS = Number(process.env.PERF_BUDGET_LOAD_MS ?? 4000);

interface NavTiming {
	domContentLoaded: number;
	load: number;
	firstByte: number;
	domInteractive: number;
}

test.describe('performance budgets', () => {
	test('login page loads within budget', async ({ page }, testInfo) => {
		await page.goto('/login');

		const timing = await page.evaluate((): NavTiming => {
			const [nav] = performance.getEntriesByType(
				'navigation',
			) as PerformanceNavigationTiming[];
			return {
				domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
				load: nav.loadEventEnd - nav.startTime,
				firstByte: nav.responseStart - nav.requestStart,
				domInteractive: nav.domInteractive - nav.startTime,
			};
		});

		await attachJson(testInfo, 'navigation-timing', {
			budgetMs: LOAD_BUDGET_MS,
			timing,
		});

		expect(timing.load).toBeLessThan(LOAD_BUDGET_MS);
		expect(timing.firstByte).toBeLessThan(LOAD_BUDGET_MS);
	});
});
