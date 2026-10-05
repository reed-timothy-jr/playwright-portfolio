import type { Page } from '@playwright/test';
import { config } from '../framework/config';

/** Base page: every page object gets navigation + the framework config. */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected get baseURL(): string {
    return config.baseURL;
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async title(): Promise<string> {
    return this.page.title();
  }
}
