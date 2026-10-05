import type { Locator, Page } from '@playwright/test';

/**
 * PowerBase self-healing locators.
 *
 * Philosophy: the primary locator is the contract. When it breaks, ordered
 * fallback strategies (role-based, text-based, CSS, ...) recover the element
 * instead of failing the test — and every healing event is logged with the
 * before/after strategy so evidence stays honest.
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

  constructor(
    private readonly page: Page,
    private readonly target: string,
    private readonly primary: (page: Page) => Locator,
    private readonly fallbacks: HealingStrategy[] = [],
    private readonly provider?: HealingProvider,
  ) {}

  /**
   * Resolve to a working Locator, healing through fallbacks as needed.
   * Throws only when every strategy (and the AI hook, if set) fails.
   */
  async resolve(timeout = 5000): Promise<Locator> {
    const errors: string[] = [];

    try {
      const locator = this.primary(this.page);
      await locator.waitFor({ state: 'attached', timeout });
      return locator;
    } catch (err) {
      errors.push(err instanceof Error ? err.message.split('\n')[0] : String(err));
    }

    for (const strategy of this.fallbacks) {
      try {
        const locator = strategy.locate(this.page);
        await locator.waitFor({ state: 'attached', timeout });
        this.events.push({
          timestamp: new Date().toISOString(),
          target: this.target,
          failedPrimaryError: errors[0] ?? 'unknown',
          healedBy: strategy.name,
          strategiesAttempted: errors.length,
        });
        return locator;
      } catch (err) {
        errors.push(`${strategy.name}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
      }
    }

    if (this.provider) {
      const html = await this.page.content().catch(() => '');
      const proposed = await this.provider.proposeLocator(errors.join(' | '), html).catch(() => null);
      if (proposed) {
        try {
          const locator = this.page.locator(proposed);
          await locator.waitFor({ state: 'attached', timeout });
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
        }
      }
    }

    throw new Error(
      `SelfHealingLocator: all ${1 + this.fallbacks.length} strategies failed for "${this.target}". ` +
        `First error: ${errors[0] ?? 'unknown'}`,
    );
  }

  /** Healing events for this instance — attach to the test report as evidence. */
  getHealingEvents(): HealingEvent[] {
    return [...this.events];
  }
}

/** Convenience factory. */
export function heal(
  page: Page,
  target: string,
  primary: (page: Page) => Locator,
  fallbacks: HealingStrategy[] = [],
  provider?: HealingProvider,
): SelfHealingLocator {
  return new SelfHealingLocator(page, target, primary, fallbacks, provider);
}
