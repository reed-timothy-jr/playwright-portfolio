import { expect, test } from '../../src/fixtures';
import { attachJson } from '../../src/support/evidence';

/**
 * PERF pillar — performance budgets via the Navigation Timing API.
 * No external tooling. Asserts the login page loads within budget and
 * attaches the full timing breakdown as evidence. Budgets come from env
 * so CI can tighten them per environment (PERF_BUDGET_LOAD_MS).
 */
const LOAD_BUDGET_MS = Number(process.env.PERF_BUDGET_LOAD_MS ?? 4000);
const TTFB_BUDGET_MS = Number(process.env.PERF_BUDGET_TTFB_MS ?? 1000);

interface NavTiming {
	domContentLoaded: number;
	load: number;
	firstByte: number;
	domInteractive: number;
}

test.describe('performance budgets', () => {
	test('login page loads within budget', async ({
		page,
		appTarget,
	}, testInfo) => {
		await page.goto(`${appTarget.url}/login`);

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
			loadBudgetMs: LOAD_BUDGET_MS,
			ttfbBudgetMs: TTFB_BUDGET_MS,
			timing,
		});

		// loadEventEnd can still be 0 if read before the event fires — a 0
		// must fail loudly, not slip under the budget.
		expect(timing.load, 'load timing was captured').toBeGreaterThan(0);
		expect(timing.load).toBeLessThan(LOAD_BUDGET_MS);
		// TTFB gets its own budget: comparing server response time against
		// the full page-load budget hides backend regressions.
		expect(timing.firstByte).toBeLessThan(TTFB_BUDGET_MS);
	});
});
