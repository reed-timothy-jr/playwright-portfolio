import type { Page, Request } from '@playwright/test';
import type { ApiEndpoint, AppModel, ScrapedForm, ScrapedPage } from './model';

/**
 * PowerBase recon crawler — points the framework at any application and
 * produces the AppModel that feeds test creation.
 *
 * Design rules:
 * - Same-origin only by default. The crawler never follows the app out
 *   onto the open web (configurable via includeSubdomains for SSO-style
 *   flows that legitimately hop hosts).
 * - Bounded: maxPages and maxDepth cap every crawl. An unbounded crawl
 *   against a big app is a DoS you inflicted on yourself.
 * - Read-only: it clicks nothing and submits nothing. Forms are *described*,
 *   never posted — test creation decides what to do with them, with a
 *   human reviewing the generated scaffolds.
 * - Takes a caller-owned Page, so auth is the caller's concern: create the
 *   context with a storageState (e.g. from tests/auth.setup.ts) and the
 *   crawl runs behind login.
 */

export interface CrawlOptions {
	/** Max pages to visit. Default 25. */
	maxPages?: number;
	/** Max link depth from the base URL. Default 3. */
	maxDepth?: number;
	/** Also crawl subdomains of the base host. Default false. */
	includeSubdomains?: boolean;
	/** Per-navigation timeout ms. Default 15000. */
	navigationTimeout?: number;
	/**
	 * URL patterns never crawled (destructive GETs like /logout).
	 * Default: [/logout].
	 */
	excludePatterns?: RegExp[];
	/** Called after each page is scraped (progress logging, etc.). */
	onPage?: (page: ScrapedPage) => void;
}

interface DomForm {
	action: string;
	method: string;
	identifier: string;
	submitText: string;
	fields: Array<{
		name: string;
		type: string;
		label: string;
		required: boolean;
	}>;
}

function isSameOrigin(
	target: URL,
	base: URL,
	includeSubdomains: boolean,
): boolean {
	if (target.protocol !== base.protocol) return false;
	const sameHost =
		target.hostname === base.hostname ||
		(includeSubdomains &&
			(target.hostname.endsWith(`.${base.hostname}`) ||
				base.hostname.endsWith(`.${target.hostname}`)));
	if (!sameHost) return false;
	// A different port is a different service, even on the same host.
	return target.port === base.port;
}

/** Normalize /users/123 and UUID segments so endpoints group by route. */
export function normalizeApiPath(pathname: string): string {
	return pathname
		.replace(
			/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
			':id',
		)
		.replace(/\/\d+(?=\/|$)/g, '/:id');
}

function isApiRequest(request: Request, base: URL): boolean {
	const type = request.resourceType();
	if (type !== 'xhr' && type !== 'fetch') return false;
	let url: URL;
	try {
		url = new URL(request.url());
	} catch {
		return false;
	}
	return url.origin === base.origin;
}

function guessFormPurpose(form: DomForm): ScrapedForm['purpose'] {
	const types = form.fields.map((f) => f.type);
	const names = form.fields.map((f) => `${f.name} ${f.label}`.toLowerCase());
	if (types.includes('password')) return 'login';
	if (names.some((n) => /search|query|^q$/.test(n))) return 'search';
	if (
		names.some((n) => /confirm|register|signup|sign up/.test(n)) &&
		types.includes('password')
	)
		return 'register';
	return 'unknown';
}

async function extractForms(page: Page): Promise<DomForm[]> {
	return page.evaluate((): DomForm[] => {
		const labelFor = (el: Element): string => {
			const id = el.getAttribute('id');
			if (id) {
				const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
				if (label?.textContent) return label.textContent.trim();
			}
			const wrapping = el.closest('label');
			if (wrapping?.textContent)
				return wrapping.textContent.trim().slice(0, 80);
			return (
				el.getAttribute('aria-label') ??
				el.getAttribute('placeholder') ??
				''
			).trim();
		};
		return Array.from(document.forms).map((form, index) => {
			const fields = Array.from(
				form.querySelectorAll('input, select, textarea'),
			).map((el) => {
				const tag = el.tagName.toLowerCase();
				const input = el as HTMLInputElement;
				return {
					name: el.getAttribute('name') ?? '',
					type: tag === 'input' ? (input.type || 'text').toLowerCase() : tag,
					label: labelFor(el),
					required: el.hasAttribute('required'),
				};
			});
			return {
				action: form.getAttribute('action') ?? '',
				method: (form.getAttribute('method') ?? 'get').toLowerCase(),
				identifier: form.id || form.getAttribute('name') || `form-${index}`,
				fields,
				submitText: (
					form.querySelector(
						'button[type="submit"], input[type="submit"], button:not([type])',
					)?.textContent ??
					form.querySelector('input[type="submit"]')?.getAttribute('value') ??
					''
				)
					.trim()
					.slice(0, 60),
			};
		});
	});
}

async function extractSameOriginLinks(
	page: Page,
	base: URL,
	includeSubdomains: boolean,
): Promise<string[]> {
	const hrefs = await page.evaluate((): string[] =>
		Array.from(document.querySelectorAll('a[href]')).map(
			(a) => (a as HTMLAnchorElement).href,
		),
	);
	const seen = new Set<string>();
	for (const href of hrefs) {
		let url: URL;
		try {
			url = new URL(href);
		} catch {
			continue;
		}
		if (!isSameOrigin(url, base, includeSubdomains)) continue;
		url.hash = '';
		seen.add(url.toString());
	}
	return [...seen];
}

/**
 * Crawl the app at baseUrl using the caller's page and return the AppModel.
 * The page's context (cookies, storageState) is used as-is — authenticate
 * the context first to crawl behind login.
 */
export async function crawlApp(
	page: Page,
	baseUrl: string,
	options: CrawlOptions = {},
): Promise<AppModel> {
	const {
		maxPages = 25,
		maxDepth = 3,
		includeSubdomains = false,
		navigationTimeout = 15000,
		excludePatterns = [/logout/],
		onPage,
	} = options;
	const base = new URL(baseUrl);
	const visited = new Set<string>();
	const queue: Array<{ url: string; depth: number }> = [
		{ url: base.toString(), depth: 0 },
	];
	const pages: ScrapedPage[] = [];

	while (queue.length > 0 && pages.length < maxPages) {
		const next = queue.shift();
		if (!next || visited.has(next.url)) continue;
		visited.add(next.url);

		const consoleErrors: string[] = [];
		const apiSeen = new Map<string, ApiEndpoint>();
		const onConsole = (msg: { type(): string; text(): string }) => {
			if (msg.type() === 'error') consoleErrors.push(msg.text());
		};
		const onRequest = (request: Request) => {
			if (!isApiRequest(request, base)) return;
			const url = new URL(request.url());
			const path = normalizeApiPath(url.pathname);
			const key = `${request.method()} ${path}`;
			if (!apiSeen.has(key)) {
				apiSeen.set(key, {
					method: request.method(),
					path,
					source: 'network',
				});
			}
		};
		page.on('console', onConsole);
		page.on('request', onRequest);

		let status = 0;
		try {
			const response = await page.goto(next.url, {
				timeout: navigationTimeout,
				waitUntil: 'domcontentloaded',
			});
			status = response?.status() ?? 0;
			// Let late XHR/fetch fire before we snapshot the page.
			await page.waitForTimeout(500);
		} catch {
			// Unreachable page: record what we can and move on. A crawl
			// that dies on one bad page is a broken recon tool.
			status = 0;
		}

		let title = '';
		let forms: ScrapedForm[] = [];
		let links: string[] = [];
		if (status !== 0) {
			title = await page.title().catch(() => '');
			const domForms = await extractForms(page).catch(() => []);
			forms = domForms.map((f) => ({ ...f, purpose: guessFormPurpose(f) }));
			links = await extractSameOriginLinks(page, base, includeSubdomains).catch(
				() => [],
			);
			// Form actions are API surface too: a POST to /authenticate is an
			// endpoint even when no XHR was observed for it.
			const pageUrl = new URL(page.url());
			for (const form of forms) {
				if (!form.action) continue;
				let actionUrl: URL;
				try {
					actionUrl = new URL(form.action, pageUrl);
				} catch {
					continue;
				}
				if (actionUrl.origin !== base.origin) continue;
				const path = normalizeApiPath(actionUrl.pathname);
				const key = `${form.method.toUpperCase()} ${path}`;
				if (!apiSeen.has(key)) {
					apiSeen.set(key, {
						method: form.method.toUpperCase(),
						path,
						source: 'form-action',
					});
				}
			}
		}

		page.off('console', onConsole);
		page.off('request', onRequest);

		// Record the FINAL url: redirects (e.g. /secure → /login) must not
		// be inventoried as separate pages under the requested URL.
		const finalUrl = status === 0 ? next.url : page.url();
		if (finalUrl !== next.url) {
			if (visited.has(finalUrl)) continue;
			visited.add(finalUrl);
		}
		const url = new URL(finalUrl);
		pages.push({
			url: finalUrl,
			path: `${url.pathname}${url.search}`,
			title,
			status,
			forms,
			sameOriginLinks: links.length,
			consoleErrors: consoleErrors.length,
			apiEndpoints: [...apiSeen.values()],
		});
		onPage?.(pages[pages.length - 1] as ScrapedPage);

		if (next.depth < maxDepth) {
			for (const link of links) {
				if (excludePatterns.some((re) => re.test(link))) continue;
				if (!visited.has(link) && pages.length + queue.length < maxPages) {
					queue.push({ url: link, depth: next.depth + 1 });
				}
			}
		}
	}

	return {
		version: 1,
		baseUrl: base.toString(),
		scrapedAt: new Date().toISOString(),
		pages,
	};
}
