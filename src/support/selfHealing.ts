import type { Locator, Page } from '@playwright/test';

/**
 * PowerBase self-healing locators.
 *
 * Philosophy: the primary locator is the contract. When it breaks, ordered
 * fallback strategies (role-based, text-based, CSS, ...) recover the element
 * instead of failing the test — and every healing event is logged with the
 * before/after strategy so evidence stays honest.
 *
 * Hardening rules (the framework never hides what it did):
 * - A fallback heals ONLY on an unambiguous match (exactly one element).
 *   Zero matches → failed; several → ambiguous-rejected. Healing to an
 *   ambiguous match could click the wrong thing and still pass — worse
 *   than failing.
 * - `strict` mode applies the same rule to the PRIMARY: an ambiguous
 *   contract fails fast instead of healing (fix the locator, don't guess).
 * - `maxAttempts` bounds how many fallbacks are tried.
 * - Every attempt is recorded in the audit log, so a recovered test is
 *   always distinguishable from a clean pass (see getAttemptLog()).
 *
 * An optional AI provider hook (HealingProvider) can propose a locator from
 * the error + page HTML. Deterministic strategies always run first; the AI
 * is a last resort, never a silent rewrite.
 */

export interface HealingStrategy {
	/** Human-readable name, e.g. 'role-button', 'css-submit'. */
	name: string;
	locate: (page: Page) => Locator;
}

export interface HealingEvent {
	timestamp: string;
	target: string;
	failedPrimaryError: string;
	healedBy: string;
	strategiesAttempted: number;
}

export type HealingAttemptOutcome =
	| 'primary-ok'
	| 'healed'
	| 'ambiguous-rejected'
	| 'failed';

export interface HealingAttempt {
	/** Strategy name, or 'primary' for the contract locator. */
	strategy: string;
	outcome: HealingAttemptOutcome;
	detail?: string;
}

export interface HealingOptions {
	/**
	 * When true, the PRIMARY locator is pre-checked: it must match exactly
	 * one element, otherwise resolve() fails fast with a clear ambiguity
	 * error instead of trying fallbacks (an ambiguous contract is broken —
	 * healing would be guessing). Default false.
	 */
	strict?: boolean;
	/** Maximum fallback strategies to try. Defaults to all provided. */
	maxAttempts?: number;
}

export interface HealingProvider {
	/**
	 * Propose a locator string given the failure. Return null to skip.
	 * Implement against any LLM (OpenAI, Anthropic, Gemini...) — the
	 * framework owns the contract, the model is replaceable.
	 */
	proposeLocator(error: string, pageHtml: string): Promise<string | null>;
}

export class SelfHealingLocator {
	private events: HealingEvent[] = [];
	private attemptLog: HealingAttempt[] = [];

	constructor(
		private readonly page: Page,
		private readonly target: string,
		private readonly primary: (page: Page) => Locator,
		private readonly fallbacks: HealingStrategy[] = [],
		private readonly provider?: HealingProvider,
		private readonly options: HealingOptions = {},
	) {}

	/**
	 * Resolve to a working Locator, healing through fallbacks as needed.
	 *
	 * Safety rule: a fallback heals ONLY when it matches exactly one
	 * element. Zero matches → failed; more than one → ambiguous-rejected.
	 * Healing to an ambiguous match could click the wrong element and
	 * still pass — worse than failing. In strict mode the primary gets
	 * the same treatment and fails fast instead of healing.
	 *
	 * Throws when every strategy fails or is rejected as ambiguous.
	 */
	async resolve(timeout = 5000): Promise<Locator> {
		const errors: string[] = [];
		const maxAttempts = this.options.maxAttempts ?? this.fallbacks.length;
		const candidates = this.fallbacks.slice(0, Math.max(0, maxAttempts));

		const primary = this.primary(this.page);
		if (this.options.strict === true) {
			const primaryCount = await primary.count();
			if (primaryCount !== 1) {
				const detail = `primary matched ${primaryCount} elements, expected exactly 1`;
				this.attemptLog.push({
					strategy: 'primary',
					outcome: 'ambiguous-rejected',
					detail,
				});
				throw new Error(
					`SelfHealingLocator: ambiguous primary for "${this.target}" — ${detail}. ` +
						`Fix the contract locator instead of healing.`,
				);
			}
		}
		try {
			await primary.waitFor({ state: 'attached', timeout });
			this.attemptLog.push({ strategy: 'primary', outcome: 'primary-ok' });
			return primary;
		} catch (err) {
			const detail =
				err instanceof Error ? err.message.split('\n')[0] : String(err);
			errors.push(detail);
			this.attemptLog.push({ strategy: 'primary', outcome: 'failed', detail });
		}

		for (const strategy of candidates) {
			const locator = strategy.locate(this.page);
			let count: number;
			try {
				count = await locator.count();
			} catch (err) {
				const detail = `${strategy.name}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`;
				errors.push(detail);
				this.attemptLog.push({
					strategy: strategy.name,
					outcome: 'failed',
					detail,
				});
				continue;
			}
			if (count === 0) {
				const detail = `${strategy.name}: matched no elements`;
				errors.push(detail);
				this.attemptLog.push({
					strategy: strategy.name,
					outcome: 'failed',
					detail,
				});
				continue;
			}
			if (count > 1) {
				const detail = `${strategy.name}: matched ${count} elements, expected exactly 1`;
				errors.push(detail);
				this.attemptLog.push({
					strategy: strategy.name,
					outcome: 'ambiguous-rejected',
					detail,
				});
				continue;
			}
			try {
				await locator.waitFor({ state: 'attached', timeout });
			} catch (err) {
				const detail = `${strategy.name}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`;
				errors.push(detail);
				this.attemptLog.push({
					strategy: strategy.name,
					outcome: 'failed',
					detail,
				});
				continue;
			}
			this.attemptLog.push({ strategy: strategy.name, outcome: 'healed' });
			this.events.push({
				timestamp: new Date().toISOString(),
				target: this.target,
				failedPrimaryError: errors[0] ?? 'unknown',
				healedBy: strategy.name,
				strategiesAttempted: errors.length,
			});
			return locator;
		}

		if (this.provider) {
			const html = await this.page.content().catch(() => '');
			const proposed = await this.provider
				.proposeLocator(errors.join(' | '), html)
				.catch(() => null);
			if (proposed) {
				try {
					const locator = this.page.locator(proposed);
					await locator.waitFor({ state: 'attached', timeout });
					this.attemptLog.push({
						strategy: `ai-provider:${proposed}`,
						outcome: 'healed',
					});
					this.events.push({
						timestamp: new Date().toISOString(),
						target: this.target,
						failedPrimaryError: errors[0] ?? 'unknown',
						healedBy: `ai-provider:${proposed}`,
						strategiesAttempted: errors.length,
					});
					return locator;
				} catch {
					errors.push('ai-provider: proposed locator did not resolve');
					this.attemptLog.push({
						strategy: 'ai-provider',
						outcome: 'failed',
						detail: 'proposed locator did not resolve',
					});
				}
			}
		}

		throw new Error(
			`SelfHealingLocator: all ${1 + candidates.length} strategies failed for "${this.target}". ` +
				`First error: ${errors[0] ?? 'unknown'}`,
		);
	}

	/** Healing events for this instance — attach to the test report as evidence. */
	getHealingEvents(): HealingEvent[] {
		return [...this.events];
	}

	/**
	 * Full audit log: every strategy attempted and its outcome.
	 * A recovered test ALWAYS has 'healed' entries here — this is what
	 * distinguishes it from a clean pass in the report.
	 */
	getAttemptLog(): HealingAttempt[] {
		return [...this.attemptLog];
	}
}

/** Convenience factory. */
export function heal(
	page: Page,
	target: string,
	primary: (page: Page) => Locator,
	fallbacks: HealingStrategy[] = [],
	provider?: HealingProvider,
	options: HealingOptions = {},
): SelfHealingLocator {
	return new SelfHealingLocator(
		page,
		target,
		primary,
		fallbacks,
		provider,
		options,
	);
}
