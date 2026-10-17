import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';

/**
 * E2E pillar — DECISION TABLE technique (ISTQB CTFL Ch. 4), applied to
 * the login rules. The fixture app's authentication has two conditions
 * (username known? password correct?) and three observable outcomes,
 * giving four rules worth executing:
 *
 *   Rule  Username known  Password correct  Expected outcome
 *   R1    yes             yes               Secure area
 *   R2    yes             no                "Your password is invalid!"
 *   R3    no              yes (well-formed) "Your username is invalid!"
 *   R4    no              no                "Your username is invalid!"
 *
 * R4 is the row teams forget: it proves the username is evaluated
 * first — an unknown user gets the username message regardless of the
 * password, which is also the anti-enumeration behavior you want to
 * pin down before someone "fixes" it into leaking which check failed.
 */
const RULES = [
	{
		rule: 'R1 known user + correct password lands in the secure area',
		username: 'tomsmith',
		password: 'SuperSecretPassword!',
		flash: 'You logged into a secure area!',
	},
	{
		rule: 'R2 known user + wrong password reports the password',
		username: 'tomsmith',
		password: 'wrong-password',
		flash: 'Your password is invalid!',
	},
	{
		rule: 'R3 unknown user + well-formed password reports the username',
		username: 'nosuchuser',
		password: 'SuperSecretPassword!',
		flash: 'Your username is invalid!',
	},
	{
		rule: 'R4 unknown user + wrong password still reports the username',
		username: 'nosuchuser',
		password: 'wrong-password',
		flash: 'Your username is invalid!',
	},
] as const;

test.describe('login decision table', () => {
	for (const { rule, username, password, flash } of RULES) {
		test(rule, async ({ page, appTarget }) => {
			const login = new LoginPage(page, appTarget.url);
			await login.login(username, password);
			await expect(login.flash).toContainText(flash);
		});
	}
});
