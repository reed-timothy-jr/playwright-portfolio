import { expect, test } from '../../src/fixtures';
import { attachJson } from '../../src/support/evidence';

/**
 * SEC pillar — baseline security headers.
 *
 * Framing: these are baseline hygiene checks, not a penetration test.
 * The fixture app ships the baseline trio; point BASE_URL at your own
 * app and this suite tells you whether it meets the same bar. Failing
 * here means "add the header", not "you've been hacked".
 *
 * Skips gracefully when the target is unreachable (no network shaming).
 */

const REQUIRED_HEADERS = [
	'x-content-type-options', // nosniff — blocks MIME-sniffing attacks
	'x-frame-options', // anti-clickjacking
	'referrer-policy', // controls referrer leakage
] as const;

async function fetchHeaders(
	url: string,
): Promise<Headers | null> {
	try {
		const res = await fetch(url, { redirect: 'manual' });
		return res.headers;
	} catch {
		return null;
	}
}

test.describe('security headers', () => {
	test('baseline security headers are present on responses', async ({
		appTarget,
	}, testInfo) => {
		const headers = await fetchHeaders(`${appTarget.url}/login`);
		test.skip(!headers, 'target unreachable — skipping header checks');

		const report: Record<string, string | null> = {};
		for (const name of REQUIRED_HEADERS) {
			report[name] = headers?.get(name) ?? null;
		}
		await attachJson(testInfo, 'security-headers', {
			target: appTarget.url,
			isFixture: appTarget.isFixture,
			report,
		});

		for (const name of REQUIRED_HEADERS) {
			expect(
				report[name],
				`missing required security header: ${name}`,
			).toBeTruthy();
		}
		expect(report['x-content-type-options']).toBe('nosniff');
	});

	test('responses do not leak server technology versions', async ({
		appTarget,
	}, testInfo) => {
		const headers = await fetchHeaders(`${appTarget.url}/login`);
		test.skip(!headers, 'target unreachable — skipping header checks');

		const server = headers?.get('server');
		const poweredBy = headers?.get('x-powered-by');
		await attachJson(testInfo, 'server-disclosure', { server, poweredBy });

		// Version strings help attackers fingerprint the stack.
		expect(server).toBeNull();
		expect(poweredBy).toBeNull();
	});
});
