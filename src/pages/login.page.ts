import { BasePage } from './base.page';

/**
 * Login page object — example target: the-internet.herokuapp.com/login.
 * Swap selectors for your app; the pattern (named locators, action methods
 * that read like the user story) stays the same.
 */
export class LoginPage extends BasePage {
  private readonly path = '/login';

  get username() {
    return this.page.locator('#username');
  }

  get password() {
    return this.page.locator('#password');
  }

  get submit() {
    return this.page.locator('button[type="submit"]');
  }

  get flash() {
    return this.page.locator('#flash');
  }

  async open(): Promise<void> {
    await this.goto(this.path);
  }

  async login(username: string, password: string): Promise<void> {
    await this.open();
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }
}
