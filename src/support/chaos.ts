import type { CDPSession, Page, Route } from '@playwright/test';

/**
 * PowerBase chaos engineering: bounded fault injection against test
 * environments. Stress-test resiliency by injecting real-world faults —
 * latency, errors, aborts — and observe how the application behaves.
 *
 * Never pointed at production without explicit approval; experiments are
 * scoped by URL pattern and fully logged.
 *
 * Two fault kinds, kept distinct:
 * - HTTP faults (errorStatus): the request completes with a failure status
 *   via route.fulfill() — the app sees a real HTTP response.
 * - Network faults: route.abort() — the request never completes, like a
 *   dropped connection. No status is asserted on these; there is none.
 */

export interface ChaosSettings {
	/** Extra latency (ms) injected into matching requests. */
	latencyMs?: number;
	/**
	 * Probability (0-1) a matching request is faulted instead of passing
	 * through. 0 disables faulting (latency-only mode).
	 */
	errorRate?: number;
	/** HTTP status used when a request is faulted. Default 500. */
	errorStatus?: number;
	/**
	 * When true, faults abort the request (network failure). When false
	 * (default), faults fulfill with errorStatus (HTTP failure).
	 */
	abortInsteadOfFulfill?: boolean;
	/** Which requests to target. Defaults to everything. */
	urlPattern?: string | RegExp;
	/**
	 * Random source for fault decisions. Defaults to Math.random — pass a
	 * seeded PRNG for deterministic experiments.
	 */
	random?: () => number;
}

export interface InterceptRecord {
	timestamp: string;
	url: string;
	action: 'delayed' | 'faulted' | 'aborted' | 'passed';
	latencyMs?: number;
	status?: number;
}

export class ChaosInjector {
	private records: InterceptRecord[] = [];
	private handler?: (route: Route) => Promise<void>;
	private pattern?: string | RegExp;
	private started = false;
	private wasOffline = false;
	private cdpSession?: CDPSession;

	constructor(private readonly page: Page) {}

	/**
	 * Start the experiment. Throws if already started — double-starting
	 * would stack route handlers and double-count interceptions.
	 */
	async start(settings: ChaosSettings = {}): Promise<void> {
		if (this.started) {
			throw new Error(
				'ChaosInjector.start() called twice — call stop() first.',
			);
		}
		const {
			latencyMs = 0,
			errorRate = 0,
			errorStatus = 500,
			abortInsteadOfFulfill = false,
			urlPattern = '**/*',
			random = Math.random,
		} = settings;
		this.pattern = urlPattern;

		this.handler = async (route: Route) => {
			const url = route.request().url();
			const timestamp = new Date().toISOString();

			if (errorRate > 0 && random() < errorRate) {
				if (abortInsteadOfFulfill) {
					this.records.push({ timestamp, url, action: 'aborted' });
					await route.abort();
				} else {
					this.records.push({
						timestamp,
						url,
						action: 'faulted',
						status: errorStatus,
					});
					await route.fulfill({ status: errorStatus, body: '' });
				}
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
		this.started = true;
	}

	/**
	 * Stop the experiment and restore state: route handler removed,
	 * offline mode reverted, CPU throttling released, CDP session detached.
	 */
	async stop(): Promise<void> {
		if (this.handler && this.pattern) {
			await this.page
				.unroute(this.pattern, this.handler)
				.catch(() => undefined);
			this.handler = undefined;
			this.pattern = undefined;
		}
		if (this.wasOffline) {
			await this.page
				.context()
				.setOffline(false)
				.catch(() => undefined);
			this.wasOffline = false;
		}
		if (this.cdpSession) {
			await this.cdpSession
				.send('Emulation.setCPUThrottlingRate', { rate: 1 })
				.catch(() => undefined);
			await this.cdpSession.detach().catch(() => undefined);
			this.cdpSession = undefined;
		}
		this.started = false;
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
	// Combine with network faults for full-spectrum chaos. stop() undoes
	// the reversible ones; storage wipes are destructive by nature.
	// ------------------------------------------------------------------

	/** Simulate the device going offline. Requests fail; the app must cope. */
	async goOffline(): Promise<void> {
		await this.page.context().setOffline(true);
		this.wasOffline = true;
	}

	async goOnline(): Promise<void> {
		await this.page.context().setOffline(false);
		this.wasOffline = false;
	}

	/**
	 * Throttle the CPU (4x slowdown) to surface race conditions and jank.
	 * Chromium-only (CDP). Undone by stop().
	 */
	async throttleCPU(rate = 4): Promise<void> {
		if (!this.cdpSession) {
			const session = await this.page.context().newCDPSession(this.page);
			this.cdpSession = session;
		}
		await this.cdpSession.send('Emulation.setCPUThrottlingRate', { rate });
	}

	/** Wipe localStorage + sessionStorage mid-flow — SPAs must recover. */
	async wipeStorage(): Promise<void> {
		await this.page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});
	}
}
