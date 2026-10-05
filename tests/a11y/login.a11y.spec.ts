import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../../src/fixtures';

/**
 * Accessibility suite — axe-core against WCAG 2.0 A + 2.1 AA.
 * Scoped to critical/serious impacts: a portfolio repo should catch
 * blockers without turning every contrast nit into a red build.
 * Tighten the filter (or assert zero violations) per your team's bar.
 */
test.describe('accessibility', () => {
	test('login page has no critical or serious a11y violations', async ({
		page,
	}) => {
		await page.goto('/login');

		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa'])
			.analyze();

		const blockers = results.violations.filter(
			(v) => v.impact === 'critical' || v.impact === 'serious',
		);
		expect(
			blockers.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
		).toEqual([]);
	});
});
