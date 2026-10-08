import type { Page, TestInfo } from '@playwright/test';

/**
 * PowerBase evidence helpers — every failure ships with proof, not just
 * an assertion message. Attach screenshots, DOM snapshots, and structured
 * JSON (healing events, chaos interceptions, API payloads) to the report.
 */

export async function attachScreenshot(
	testInfo: TestInfo,
	page: Page,
	name = 'failure',
): Promise<void> {
	const body = await page.screenshot({ fullPage: true }).catch(() => undefined);
	if (body) {
		await testInfo.attach(`${name}-screenshot`, {
			body,
			contentType: 'image/png',
		});
	}
}

export async function attachDomSnapshot(
	testInfo: TestInfo,
	page: Page,
	name = 'dom',
): Promise<void> {
	const html = await page.content().catch(() => '');
	if (html) {
		await testInfo.attach(`${name}-snapshot`, {
			body: html,
			contentType: 'text/html',
		});
	}
}

export async function attachJson(
	testInfo: TestInfo,
	name: string,
	data: unknown,
): Promise<void> {
	await testInfo.attach(name, {
		body: JSON.stringify(data, null, 2),
		contentType: 'application/json',
	});
}

/** One call: screenshot + DOM snapshot, for defect-grade evidence. */
export async function captureFailureEvidence(
	testInfo: TestInfo,
	page: Page,
	consoleErrors: string[] = [],
): Promise<void> {
	await attachScreenshot(testInfo, page);
	await attachDomSnapshot(testInfo, page);
	if (consoleErrors.length > 0) {
		await attachJson(testInfo, 'console-errors', consoleErrors);
	}
}
