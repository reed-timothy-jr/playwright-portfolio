import { expect, test } from '../../src/fixtures';
import { ChaosInjector } from '../../src/support/chaos';

/**
 * UNIT suite — focused tests for the chaos injector's lifecycle guarantees.
 * The critical property: a fault experiment must always restore the page,
 * even when the test body throws — otherwise one failure poisons the rest
 * of the run.
 */
test.describe('chaos injector unit', () => {
	test('stop() removes the route handler even when the test body throws', async ({
		page,
	}) => {
		const injector = new ChaosInjector(page);
		await injector.start({ errorRate: 1, urlPattern: '**/boom/**' });

		// Simulate a test body that throws mid-experiment.
		try {
			await expect(
				page.goto('http://127.0.0.1:9/boom/x', { timeout: 5000 }),
			).rejects.toThrow();
			throw new Error('simulated test-body failure');
		} catch (err) {
			expect((err as Error).message).toBe('simulated test-body failure');
		} finally {
			await injector.stop();
		}

		const before = injector.getInterceptions().length;
		// After stop(), matching navigations are no longer intercepted.
		await expect(
			page.goto('http://127.0.0.1:9/boom/y', { timeout: 5000 }),
		).rejects.toThrow();
		expect(injector.getInterceptions()).toHaveLength(before);
		expect(injector.faultedCount).toBeGreaterThan(0);
	});

	test('aborted requests are recorded with status, not just counted', async ({
		page,
	}) => {
		const injector = new ChaosInjector(page);
		try {
			await injector.start({
				errorRate: 1,
				errorStatus: 503,
				urlPattern: '**/down/**',
			});
			await expect(
				page.goto('http://127.0.0.1:9/down/x', { timeout: 5000 }),
			).rejects.toThrow();
			const aborted = injector
				.getInterceptions()
				.filter((r) => r.action === 'aborted');
			expect(aborted.length).toBeGreaterThan(0);
			expect(aborted[0].status).toBe(503);
			expect(aborted[0].url).toContain('/down/');
		} finally {
			await injector.stop();
		}
	});
});
