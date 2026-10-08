#!/usr/bin/env tsx
/**
 * PowerBase recon CLI — point the framework at any application and capture
 * the AppModel that feeds test creation.
 *
 * Usage:
 *   npm run recon -- --url https://your-app.example [--out app-model.json]
 *                   [--max-pages 25] [--max-depth 3] [--auth-state storageState.json]
 *                   [--include-subdomains]
 *
 * The crawl is read-only and same-origin by default: it clicks nothing and
 * submits nothing. Authenticate first when the app needs login — pass a
 * Playwright storageState (e.g. the one tests/auth.setup.ts produces).
 *
 * Output is a versioned, Zod-validated JSON model. Check it in: generated
 * tests are only as deterministic as the model they come from.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { crawlApp } from '../src/support/recon/crawler';
import { serializeAppModel } from '../src/support/recon/model';

function arg(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	return idx === -1 ? undefined : process.argv[idx + 1];
}

function flag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
	const url = arg('url') ?? process.env.RECON_URL;
	if (!url) {
		console.error('Missing target. Provide --url <base-url> or set RECON_URL.');
		process.exit(1);
	}
	const out = arg('out') ?? 'app-model.json';
	const maxPages = Number(arg('max-pages') ?? 25);
	const maxDepth = Number(arg('max-depth') ?? 3);
	const authState = arg('auth-state');

	const browser = await chromium.launch();
	try {
		const context = await browser.newContext(
			authState ? { storageState: authState } : {},
		);
		const page = await context.newPage();
		let crawled = 0;
		const model = await crawlApp(page, url, {
			maxPages,
			maxDepth,
			includeSubdomains: flag('include-subdomains'),
			onPage: (p) => {
				crawled += 1;
				console.log(
					`  [${crawled}] ${p.status} ${p.path} — ${p.forms.length} form(s), ${p.apiEndpoints.length} api endpoint(s), ${p.consoleErrors} console error(s)`,
				);
			},
		});
		await context.close();

		await writeFile(out, serializeAppModel(model), 'utf8');
		const formCount = model.pages.reduce((n, p) => n + p.forms.length, 0);
		const apiCount = model.pages.reduce((n, p) => n + p.apiEndpoints.length, 0);
		console.log(
			`\nRecon complete: ${model.pages.length} page(s), ${formCount} form(s), ${apiCount} api endpoint(s) → ${out}`,
		);
		console.log(`Next: npm run scaffold -- --model ${out}`);
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error('Recon failed:', error);
	process.exit(1);
});
