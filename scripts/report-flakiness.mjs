#!/usr/bin/env node
/**
 * report-flakiness.mjs — separate first-attempt results from retries.
 *
 * Reads test-results/results.json (Playwright JSON reporter) and prints,
 * per spec: whether it passed on the FIRST attempt, passed only after
 * retries (flaky), or failed outright. Retries hide rot — this makes the
 * hiding visible. Informational: always exits 0 (the test step itself
 * already gates the build).
 *
 * Usage: npm run report:flakiness
 */
import { existsSync, readFileSync } from 'node:fs';

const REPORT = 'test-results/results.json';

if (!existsSync(REPORT)) {
	console.log(`[flakiness] no report at ${REPORT} — run the tests first.`);
	process.exit(0);
}

const data = JSON.parse(readFileSync(REPORT, 'utf8'));
const rows = [];

function walk(suites, filePrefix = '') {
	for (const suite of suites ?? []) {
		for (const spec of suite.specs ?? []) {
			const file = (spec.file ?? '').split('tests/').pop() || spec.file;
			for (const t of spec.tests ?? []) {
				const results = t.results ?? [];
				const first = results.find((r) => r.retry === 0);
				// Playwright marks retry-passes as 'flaky', not 'expected' —
				// checking only 'expected' mislabels them FAILED and keeps
				// the flaky count at 0 forever.
				const finalOk = t.status === 'expected' || t.status === 'flaky';
				// test.fail() cases fail on purpose: an expected failure is
				// not flakiness.
				const expectedToFail = t.expectedStatus === 'failed';
				let verdict;
				if (!first) verdict = 'NO-RESULT';
				else if (first.status === 'skipped') verdict = 'SKIPPED';
				else if (first.status === 'passed') verdict = 'CLEAN';
				else if (expectedToFail && finalOk) verdict = 'XFAIL';
				else if (finalOk) verdict = 'FLAKY';
				else verdict = 'FAILED';
				rows.push({
					file: `${filePrefix}${file}`,
					title: t.title ?? spec.title,
					verdict,
					attempts: results.length,
				});
			}
		}
		walk(suite.suites, filePrefix);
	}
}
walk(data.suites);

const counts = {
	CLEAN: 0,
	FLAKY: 0,
	FAILED: 0,
	SKIPPED: 0,
	XFAIL: 0,
	'NO-RESULT': 0,
};
for (const r of rows) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;

console.log('\n[flakiness] first-attempt vs retries\n');
console.log(`${'VERDICT'.padEnd(10)} ${'ATTEMPTS'.padEnd(9)} SPEC`);
for (const r of rows) {
	console.log(
		`${r.verdict.padEnd(10)} ${String(r.attempts).padEnd(9)} ${r.file} › ${r.title}`,
	);
}
console.log(
	`\n[flakiness] clean=${counts.CLEAN} flaky=${counts.FLAKY} failed=${counts.FAILED} skipped=${counts.SKIPPED}`,
);
if (counts.FLAKY > 0) {
	console.log(
		'[flakiness] FLAKY specs passed only after retries — quarantine candidates (see docs/whats-next.md).',
	);
}
