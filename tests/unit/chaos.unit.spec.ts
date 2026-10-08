import { expect, test } from '../../src/fixtures';
import { ChaosInjector } from '../../src/support/chaos';
import { startFixtureApp } from '../../src/support/fixtureApp';

/**
 * UNIT suite — focused tests for the chaos injector's lifecycle guarantees.
 * The critical property: a fault experiment must always restore the page,
 * even when the test body throws — otherwise one failure poisons the rest
 * of the run.
 *
 * Fault kinds are distinct: HTTP faults fulfill with a status the app can
 * see; network faults abort and the request never completes.
 */
test.describe('chaos injector unit', () => {
	test('stop() removes the route handler even when the test body throws', async ({
		page,
	}) => {
		const injector = new ChaosInjector(page);
		await injector.start({ errorRate: 1, urlPattern: '**/boom/**' });

		// Simulate a test body that throws mid-experiment.
		try {
			const response = await page.goto('http://127.0.0.1:59999/boom/x', {
				timeout: 5000,
			});
			expect(response?.status()).toBe(500);
			throw new Error('simulated test-body failure');
		} catch (err) {
			expect((err as Error).message).toBe('simulated test-body failure');
		} finally {
			await injector.stop();
		}

		const before = injector.getInterceptions().length;
		// After stop(), matching navigations are no longer intercepted.
		await expect(
			page.goto('http://127.0.0.1:59999/boom/y', { timeout: 5000 }),
		).rejects.toThrow();
		expect(injector.getInterceptions()).toHaveLength(before);
		expect(injector.faultedCount).toBeGreaterThan(0);
	});

	test('HTTP faults fulfill with the configured status', async ({ page }) => {
		const injector = new ChaosInjector(page);
		try {
			await injector.start({
				errorRate: 1,
				errorStatus: 503,
				urlPattern: '**/down/**',
			});
			const response = await page.goto('http://127.0.0.1:59999/down/x', {
				timeout: 5000,
			});
			// The app sees a real HTTP response — this is the point of
			// fulfill(): the status is observable, unlike abort().
			expect(response?.status()).toBe(503);
			const faulted = injector
				.getInterceptions()
				.filter((r) => r.action === 'faulted');
			expect(faulted.length).toBeGreaterThan(0);
			expect(faulted[0]?.status).toBe(503);
			expect(faulted[0]?.url).toContain('/down/');
		} finally {
			await injector.stop();
		}
	});

	test('network faults abort with no status to assert', async ({ page }) => {
		const injector = new ChaosInjector(page);
		try {
			await injector.start({
				errorRate: 1,
				abortInsteadOfFulfill: true,
				urlPattern: '**/cut/**',
			});
			await expect(
				page.goto('http://127.0.0.1:59999/cut/x', { timeout: 5000 }),
			).rejects.toThrow();
			const aborted = injector
				.getInterceptions()
				.filter((r) => r.action === 'aborted');
			expect(aborted.length).toBeGreaterThan(0);
			expect(aborted[0]?.status).toBeUndefined();
		} finally {
			await injector.stop();
		}
	});

	test('start() twice throws instead of stacking handlers', async ({
		page,
	}) => {
		const injector = new ChaosInjector(page);
		try {
			await injector.start({ urlPattern: '**/twice/**' });
			await expect(
				injector.start({ urlPattern: '**/twice/**' }),
			).rejects.toThrow(/called twice/);
		} finally {
			await injector.stop();
		}
	});

	test('stop() restores offline mode', async ({ page }) => {
		const app = await startFixtureApp();
		const injector = new ChaosInjector(page);
		try {
			await injector.goOffline();
			// Offline is behavioral: even the reachable fixture app refuses.
			await expect(
				page.goto(`${app.url}/login`, { timeout: 5000 }),
			).rejects.toThrow();
		} finally {
			// goOnline() deliberately never called — stop() must restore.
			await injector.stop();
		}
		// The same navigation works again after stop().
		const response = await page.goto(`${app.url}/login`, { timeout: 5000 });
		expect(response?.status()).toBe(200);
		await app.close();
	});

	test('seeded random makes fault decisions deterministic', async ({
		page,
	}) => {
		const scripted = [0.1, 0.9, 0.1, 0.9];
		let i = 0;
		const injector = new ChaosInjector(page);
		try {
			await injector.start({
				errorRate: 0.5,
				urlPattern: '**/coin/**',
				random: () => scripted[i++ % scripted.length] ?? 0,
			});
			for (let n = 0; n < 4; n++) {
				// Faulted navigations fulfill with 500; passed-through ones
				// hit the unroutable address and reject — both are recorded.
				await page
					.goto(`http://127.0.0.1:59999/coin/${n}`, { timeout: 5000 })
					.catch(() => null);
			}
			const actions = injector.getInterceptions().map((r) => r.action);
			expect(actions).toEqual(['faulted', 'passed', 'faulted', 'passed']);
		} finally {
			await injector.stop();
		}
	});
});
