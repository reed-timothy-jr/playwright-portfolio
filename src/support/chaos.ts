import type { Page, Route } from '@playwright/test';

/**
 * PowerBase chaos engineering: bounded fault injection against test
 * environments. Stress-test resiliency by injecting real-world faults —
 * latency, errors, aborts — and observe how the application behaves.
 *
 * Never pointed at production without explicit approval; experiments are
 * scoped by URL pattern and fully logged.
 */

export interface ChaosSettings {
	/** Extra latency (ms) injected into matching requests. */
	latencyMs?: number;
	/** Probability (0-1) a matching request fails instead of passing through. */
	errorRate?: number;
	/** HTTP status used when a request is failed. */
	errorStatus?: number;
	/** Which requests to target. Defaults to everything. */
	urlPattern?: string | RegExp;
}

export interface InterceptRecord {
	timestamp: string;
	url: string;
	action: 'delayed' | 'aborted' | 'passed';
	latencyMs?: number;
	status?: number;
}

export class ChaosInjector {
	private records: InterceptRecord[] = [];
	private handler?: (route: Route) => Promise<void>;
	private pattern?: string | RegExp;

	constructor(private readonly page: Page) {}

	/** Start the experiment. Safe to call once per injector. */
	async start(settings: ChaosSettings = {}): Promise<void> {
		const {
			latencyMs = 0,
			errorRate = 0,
			errorStatus = 500,
			urlPattern = '**/*',
		} = settings;
		this.pattern = urlPattern;

		this.handler = async (route: Route) => {
			const url = route.request().url();
			const timestamp = new Date().toISOString();

			if (errorRate > 0 && Math.random() < errorRate) {
				this.records.push({
					timestamp,
					url,
					action: 'aborted',
					status: errorStatus,
				});
				await route.abort();
				return;
			}

			if (latencyMs > 0) {
				this.records.push({ timestamp, url, action: 'delayed', latencyMs });
				await new Promise((resolve) => setTimeout(resolve, latencyMs));
			} else {
				this.records.push({ timestamp, url, action: 'passed' });
			}
			await route.continue();
		};

		await this.page.route(urlPattern, this.handler);
	}

	/** Stop the experiment and remove the route handler. */
	async stop(): Promise<void> {
		if (this.handler && this.pattern) {
			await this.page
				.unroute(this.pattern, this.handler)
				.catch(() => undefined);
			this.handler = undefined;
		}
	}

	/** Every intercepted request, in order — attach to the report as evidence. */
	getInterceptions(): InterceptRecord[] {
		return [...this.records];
	}

	/** Convenience: did any request get faulted? */
	get faultedCount(): number {
		return this.records.filter((r) => r.action !== 'passed').length;
	}

	// ------------------------------------------------------------------
	// Runtime faults (page-lifecycle layer): faults the browser can reach
	// beyond the network — offline mode, CPU throttling, storage wipes.
	// Combine with network faults for full-spectrum chaos.
	// ------------------------------------------------------------------

	/** Simulate the device going offline. Requests fail; the app must cope. */
	async goOffline(): Promise<void> {
		await this.page.context().setOffline(true);
	}

	async goOnline(): Promise<void> {
		await this.page.context().setOffline(false);
	}

	/** Throttle the CPU (4x slowdown) to surface race conditions and jank. */
	async throttleCPU(rate = 4): Promise<void> {
		const session = await this.page.context().newCDPSession(this.page);
		await session.send('Emulation.setCPUThrottlingRate', { rate });
	}

	/** Wipe localStorage + sessionStorage mid-flow — SPAs must recover. */
	async wipeStorage(): Promise<void> {
		await this.page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});
	}
}
