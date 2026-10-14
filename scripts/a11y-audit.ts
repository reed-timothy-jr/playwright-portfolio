#!/usr/bin/env tsx
/**
 * PowerBase accessibility audit CLI — point the framework at any URL and
 * get a Markdown audit built on src/support/a11y.ts: full axe WCAG scan
 * plus the four focused checks (alt text, keyboard navigation, color
 * contrast, form labels).
 *
 * Usage:
 *   npm run audit:a11y -- --url https://your-app.example [--out report.md]
 *                         [--json report.json] [--max-tabs 50]
 *                         [--ignore-https-errors]
 *
 * --url may be repeated (or given as a comma-separated list) to audit
 * several routes in one report. Exit code is 1 when any audited page has
 * a critical/serious ("blocker") violation, 0 otherwise — wire that into
 * CI as the severity gate (see docs/accessibility.md).
 *
 * Read-only: the audit navigates and presses Tab; it never submits forms.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import {
	type A11yAuditResult,
	auditAccessibility,
	blockers,
	formatA11yReport,
} from '../src/support/a11y';

/**
 * Playwright proxy config from the environment — same approach as
 * playwright.config.ts (the browser does not read env vars on its own;
 * localhost always bypasses so local apps are reached directly).
 */
function proxyFromEnv():
	| { server: string; username?: string; password?: string; bypass?: string }
	| undefined {
	const raw = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
	if (!raw) return undefined;
	try {
		const url = new URL(raw);
		const proxy: {
			server: string;
			username?: string;
			password?: string;
			bypass?: string;
		} = {
			server: `${url.protocol}//${url.host}`,
			bypass: 'localhost,127.0.0.1',
		};
		if (url.username) {
			proxy.username = decodeURIComponent(url.username);
			proxy.password = decodeURIComponent(url.password);
		}
		return proxy;
	} catch {
		return { server: raw };
	}
}

/** All values for a repeatable flag, comma-split (e.g. --url a,b --url c). */
function argsAll(name: string): string[] {
	const values: string[] = [];
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}` && process.argv[i + 1]) {
			values.push(
				...process.argv[i + 1]
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
			);
		}
	}
	return values;
}

function arg(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	return idx === -1 ? undefined : process.argv[idx + 1];
}

function flag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

function emptyAudit(url: string, error: string): A11yAuditResult {
	return {
		url,
		finalUrl: url,
		title: '',
		httpStatus: null,
		error,
		axe: null,
		violations: [],
		altText: { violations: [], media: [], unnamed: [] },
		keyboard: { stops: [], findings: [], reachedMainContent: false },
		contrast: { violations: [] },
		formLabels: { violations: [], controls: [], unlabeled: [] },
	};
}

async function main(): Promise<void> {
	const urls = argsAll('url');
	if (urls.length === 0) {
		console.error(
			'Missing target. Provide --url <url> (repeatable, or comma-separated).',
		);
		process.exit(2);
	}
	const out = arg('out') ?? 'a11y-report.md';
	const jsonOut = arg('json');
	const maxTabStops = Number(arg('max-tabs') ?? 50);

	const browser = await chromium.launch();
	const audits: A11yAuditResult[] = [];
	try {
		const context = await browser.newContext({
			proxy: proxyFromEnv(),
			// Opt-in only: for targets behind TLS-inspecting proxies or with
			// self-signed certs (staging). Never enable against production
			// by default — a cert error is itself a finding worth seeing.
			ignoreHTTPSErrors: flag('ignore-https-errors'),
		});
		const page = await context.newPage();
		for (const url of urls) {
			process.stdout.write(`Auditing ${url} … `);
			try {
				const response = await page.goto(url, {
					waitUntil: 'load',
					timeout: 30_000,
				});
				await page
					.waitForLoadState('networkidle', { timeout: 10_000 })
					.catch(() => undefined);
				const audit = await auditAccessibility(page, { maxTabStops });
				audit.url = url;
				audit.httpStatus = response?.status() ?? null;
				audits.push(audit);
				const blockerNodes = blockers(audit.violations).reduce(
					(n, v) => n + v.nodes.length,
					0,
				);
				console.log(
					`HTTP ${audit.httpStatus ?? '?'}, ${audit.violations.length} rule(s), ${blockerNodes} blocker node(s)`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				audits.push(emptyAudit(url, message));
				console.log(`FAILED: ${message.split('\n')[0]}`);
			}
		}
		await context.close();
	} finally {
		await browser.close();
	}

	await writeFile(out, formatA11yReport(audits), 'utf8');
	if (jsonOut) {
		await writeFile(jsonOut, JSON.stringify(audits, null, 2), 'utf8');
	}

	const totalBlockers = audits.reduce(
		(n, a) =>
			n + blockers(a.violations).reduce((m, v) => m + v.nodes.length, 0),
		0,
	);
	console.log(
		`A11y audit complete: ${audits.length} page(s), ${totalBlockers} blocker node(s) → ${out}${jsonOut ? ` + ${jsonOut}` : ''}`,
	);
	process.exit(totalBlockers > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('A11y audit failed:', error);
	process.exit(2);
});
