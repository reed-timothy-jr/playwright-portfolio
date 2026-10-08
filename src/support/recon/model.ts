import { z } from 'zod';

/**
 * PowerBase recon app model — the structured snapshot a crawl produces.
 *
 * The model is the contract between "point at an app" and "create tests":
 * the crawler writes it, the scaffold generator reads it, and a future AI
 * test-authoring layer can consume it as grounded context about the app.
 * It is plain JSON validated by Zod, so a checked-in model file is a
 * deterministic fixture: tests generated from it are reproducible.
 */

export const ScrapedFieldSchema = z.object({
	/** Field name attribute (may be empty for unnamed controls). */
	name: z.string(),
	/** Input type / tag, e.g. 'text', 'password', 'email', 'select', 'textarea', 'checkbox'. */
	type: z.string(),
	/** Associated <label> text or aria-label, '' when unknown. */
	label: z.string(),
	required: z.boolean(),
});

export type ScrapedField = z.infer<typeof ScrapedFieldSchema>;

export const ScrapedFormSchema = z.object({
	/** Form action as written in the DOM (may be relative or empty). */
	action: z.string(),
	method: z.string(),
	/** Stable identifier for the form: id, name, or generated index. */
	identifier: z.string(),
	fields: z.array(ScrapedFieldSchema),
	/** Best-effort guess: 'login' | 'search' | 'register' | 'unknown'. */
	purpose: z.enum(['login', 'search', 'register', 'unknown']),
	/** Visible text of the form's submit button, '' when none found. */
	submitText: z.string().optional().default(''),
});

export type ScrapedForm = z.infer<typeof ScrapedFormSchema>;

export const ApiEndpointSchema = z.object({
	method: z.string(),
	/** Path with numeric/UUID segments normalized, e.g. /api/users/:id. */
	path: z.string(),
	/** Where it was seen: 'network' (observed XHR/fetch) or 'form-action'. */
	source: z.enum(['network', 'form-action']),
});

export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;

export const ScrapedPageSchema = z.object({
	/** Full URL as crawled. */
	url: z.string(),
	/** Path + query, the stable key within one app. */
	path: z.string(),
	title: z.string(),
	/** HTTP status of the initial document response. */
	status: z.number(),
	forms: z.array(ScrapedFormSchema),
	/** Count of same-origin links discovered on the page. */
	sameOriginLinks: z.number(),
	/** Console errors observed while the page loaded. */
	consoleErrors: z.number(),
	apiEndpoints: z.array(ApiEndpointSchema),
});

export type ScrapedPage = z.infer<typeof ScrapedPageSchema>;

export const AppModelSchema = z.object({
	version: z.literal(1),
	baseUrl: z.string(),
	scrapedAt: z.string(),
	pages: z.array(ScrapedPageSchema),
});

export type AppModel = z.infer<typeof AppModelSchema>;

/** Parse and validate an AppModel from unknown JSON. Throws on mismatch. */
export function parseAppModel(data: unknown): AppModel {
	return AppModelSchema.parse(data);
}

/** Serialize an AppModel to stable, human-diffable JSON. */
export function serializeAppModel(model: AppModel): string {
	return `${JSON.stringify(model, null, '\t')}\n`;
}
