import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { AxeResults, ImpactValue, Result } from 'axe-core';

/**
 * PowerBase accessibility audit module — turns the one-off axe scan into a
 * reusable audit built around the four areas a reviewer actually asks about:
 *
 *   1. Alt text            — images / graphics without accessible names
 *   2. Keyboard navigation — tab order, focus visibility, click-only traps
 *   3. Color contrast      — axe color-contrast findings with ratio data
 *   4. Form labels         — controls without a programmatic name
 *
 * …on top of a full axe-core scan against WCAG 2.0 A / 2.1 AA tags.
 *
 * Benchmark: WCAG 2.1 AA. Automated checks catch only part of WCAG —
 * a clean run here is a floor, not a certification, and nothing in this
 * module is legal advice. See docs/accessibility.md.
 */

/** WCAG tag set used for every scan (matches tests/a11y/login.a11y.spec.ts). */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export type A11yArea =
	| 'alt-text'
	| 'keyboard'
	| 'contrast'
	| 'form-labels'
	| 'general';

export interface A11yOptions {
	/** Axe tags to run. Default: WCAG_TAGS. */
	tags?: string[];
	/** CSS selectors to include (axe .include). */
	include?: string[];
	/** CSS selectors to exclude (axe .exclude). */
	exclude?: string[];
	/** Max Tab presses during the keyboard walk. Default 50. */
	maxTabStops?: number;
}

export interface ContrastData {
	ratio?: number;
	foreground?: string;
	background?: string;
	fontSize?: string;
	fontWeight?: string;
	/** Ratio axe expects for this text size (e.g. "4.5:1"). */
	expectedRatio?: string;
}

export interface A11yViolationNode {
	/** CSS selector path axe reported for the node. */
	selector: string;
	/** Outer HTML of the offending node (as reported by axe). */
	html: string;
	failureSummary?: string;
	/** Present on color-contrast nodes: the measured contrast data. */
	contrast?: ContrastData;
}

export interface A11yViolation {
	id: string;
	impact: A11yImpact | 'unknown';
	help: string;
	helpUrl: string;
	description: string;
	area: A11yArea;
	nodes: A11yViolationNode[];
}

/** An image-like element from the DOM inventory (alt-text checker). */
export interface MediaItem {
	selector: string;
	tag: string;
	html: string;
	accessibleName: string;
	hasAccessibleName: boolean;
	/** alt="" / role="presentation" — intentionally nameless, not a defect. */
	decorative: boolean;
}

export interface AltTextResult {
	violations: A11yViolation[];
	media: MediaItem[];
	/** Media items that need a name and don't have one. */
	unnamed: MediaItem[];
}

export interface KeyboardStop {
	index: number;
	selector: string;
	tag: string;
	role: string | null;
	text: string;
	/** Heuristic: computed outline or box-shadow present while focused. */
	visibleFocus: boolean;
}

export interface KeyboardFinding {
	kind:
		| 'clickable-not-focusable'
		| 'invisible-focus'
		| 'main-content-not-reached'
		| 'no-focusable-elements';
	selector?: string;
	message: string;
}

export interface KeyboardResult {
	stops: KeyboardStop[];
	findings: KeyboardFinding[];
	reachedMainContent: boolean;
}

export interface ContrastResult {
	violations: A11yViolation[];
}

export interface FormControlItem {
	selector: string;
	tag: string;
	/** input type / select / textarea / button — null when not applicable. */
	type: string | null;
	accessibleName: string;
	hasAccessibleName: boolean;
	nameSource:
		| 'label'
		| 'aria-label'
		| 'aria-labelledby'
		| 'title'
		| 'text-content'
		| 'value'
		| 'none';
}

export interface FormLabelsResult {
	violations: A11yViolation[];
	controls: FormControlItem[];
	/** Controls with no accessible name from any supported source. */
	unlabeled: FormControlItem[];
}

export interface A11yAuditResult {
	/** URL that was requested. */
	url: string;
	/** URL after any redirects. */
	finalUrl: string;
	title: string;
	/** HTTP status of the navigation, null when navigation failed. */
	httpStatus: number | null;
	/** Navigation/audit error message, when the audit could not run. */
	error?: string;
	axe: AxeResults | null;
	violations: A11yViolation[];
	altText: AltTextResult;
	keyboard: KeyboardResult;
	contrast: ContrastResult;
	formLabels: FormLabelsResult;
}

// ---------------------------------------------------------------------------
// Rule → area mapping and plain-language fix guidance
// ---------------------------------------------------------------------------

const ALT_TEXT_RULES = new Set([
	'image-alt',
	'input-image-alt',
	'area-alt',
	'object-alt',
	'role-img-alt',
	'svg-img-alt',
]);

const CONTRAST_RULES = new Set(['color-contrast', 'color-contrast-enhanced']);

const FORM_LABEL_RULES = new Set([
	'label',
	'label-title-only',
	'select-name',
	'input-button-name',
	'button-name',
	'form-field-multiple-labels',
]);

const KEYBOARD_RULES = new Set([
	'tabindex',
	'focus-order-semantics',
	'focusable-content',
	'focusable-no-name',
	'scrollable-region-focusable',
	'accesskeys',
]);

/** Which audit area an axe rule belongs to. Unmapped rules are 'general'. */
export function areaForRule(ruleId: string): A11yArea {
	if (ALT_TEXT_RULES.has(ruleId)) return 'alt-text';
	if (CONTRAST_RULES.has(ruleId)) return 'contrast';
	if (FORM_LABEL_RULES.has(ruleId)) return 'form-labels';
	if (KEYBOARD_RULES.has(ruleId)) return 'keyboard';
	return 'general';
}

/**
 * Plain-language fix per rule, from standard WCAG guidance and the axe
 * rule intent. Deliberately free of legal claims — these are engineering
 * instructions, not compliance statements.
 */
const FIX_GUIDANCE: Record<string, string> = {
	'color-contrast':
		'Raise the text/background contrast to at least 4.5:1 for normal text (3:1 for large text): darken the text or lighten the background until the reported ratio meets the expected ratio.',
	'color-contrast-enhanced':
		'Raise the text/background contrast to at least 7:1 for normal text (4.5:1 for large text) to meet the enhanced (AAA) threshold.',
	'image-alt':
		'Add an alt attribute that conveys the image\'s purpose in context. Use alt="" only when the image is purely decorative.',
	'input-image-alt':
		'Add an alt attribute to the image input describing the action it triggers (e.g. alt="Search").',
	'area-alt':
		'Add an alt attribute to each <area> describing the link destination.',
	'object-alt':
		'Give the <object> an accessible name (aria-label) or fallback text content describing it.',
	'role-img-alt':
		'Give the element with role="img" an aria-label (or aria-labelledby) that describes the graphic.',
	'svg-img-alt':
		'Give the SVG an accessible name: role="img" plus aria-label, or a <title> element as its first child. Hide purely decorative SVGs with aria-hidden="true".',
	label:
		'Associate a visible <label for="…"> with the control (or wrap the control in its <label>) so the field has a programmatic name screen readers announce.',
	'label-title-only':
		'A title attribute alone is not a label — add a real <label> or aria-label; title text is inconsistently announced and invisible on touch devices.',
	'select-name':
		'Give the <select> an accessible name via an associated <label>, aria-label, or aria-labelledby.',
	'input-button-name':
		'Give the input button discernible text via its value attribute, aria-label, or aria-labelledby.',
	'button-name':
		'Give the button discernible text: visible text content, aria-label, or aria-labelledby describing the action.',
	'form-field-multiple-labels':
		'Remove the duplicate labels so the control has a single, unambiguous label.',
	'link-name':
		'Give the link discernible text (visible text or aria-label) that describes where it goes — avoid bare icon links.',
	'heading-order':
		'Fix the heading outline so levels do not skip (h1 → h2 → h3) and headings reflect the document structure, not just font size.',
	'page-has-heading-one': "Add a single <h1> that names the page's main topic.",
	'html-has-lang':
		'Add a lang attribute to the <html> element (e.g. lang="en") so assistive tech uses the right pronunciation rules.',
	'document-title':
		'Give the page a descriptive <title> in the <head> that identifies the page.',
	'landmark-one-main':
		'Wrap the primary content in exactly one <main> landmark.',
	region:
		'Place page content inside landmarks (header, nav, main, footer or role equivalents) so screen-reader users can navigate by region.',
	'duplicate-id':
		'Make every id attribute unique on the page — duplicate ids break <label for> and ARIA references.',
	'frame-title':
		'Add a title attribute to the frame that describes its content.',
	'video-caption': 'Provide synchronized captions for the video content.',
	tabindex:
		'Avoid positive tabindex values. Use tabindex="0" (or fix the DOM order) so the tab order follows the visual order.',
	'meta-viewport':
		'Do not disable zoom in the viewport meta tag (remove user-scalable=no and maximum-scale below 2).',
	'empty-heading': 'Remove the empty heading or give it text content.',
	'empty-table-header':
		'Give the table header cell text content, or remove it if it is not a header.',
	'td-headers-attr':
		"Point each cell's headers attribute at the ids of its header cells, or restructure the table with proper <th> elements.",
	'table-fake-caption':
		'Use a real <caption> element for the table summary instead of a cell styled to look like one.',
	'definition-list':
		'Structure definition lists with proper <dt>/<dd> groups inside the <dl>.',
	dlitem:
		'Wrap <dt> and <dd> elements in a <dl> (grouped in <div> where needed).',
	list: 'Use real list markup: <ul>/<ol> with <li> children for list content.',
	listitem: 'Place <li> elements inside a <ul> or <ol>.',
	'nested-interactive':
		'Do not nest interactive elements (a link inside a button, etc.) — keep one interactive element per control.',
	'aria-hidden-focus':
		'Remove focusable elements from aria-hidden subtrees, or remove aria-hidden so the content is perceivable consistently.',
	'focusable-no-name':
		'Give the focusable element an accessible name (text content, aria-label, or aria-labelledby) so its purpose is announced when focused.',
	'scrollable-region-focusable':
		'Make the scrollable region keyboard-focusable (tabindex="0") and give it an accessible name.',
	accesskeys:
		'Remove the accesskey attribute or pick a value that does not conflict with browser and assistive-tech shortcuts.',
	bypass:
		'Add a "skip to content" link as the first focusable element, or provide heading/landmark structure that lets users bypass repeated blocks.',
	'target-size':
		'Increase the interactive target to at least 24×24 CSS pixels (44×44 is the safer touch target).',
};

/** Plain-language "how to fix" for a rule id (falls back to the axe help link). */
export function fixGuidance(violation: A11yViolation): string {
	return (
		FIX_GUIDANCE[violation.id] ??
		`Follow the axe guidance for this rule (${violation.helpUrl}), fix the markup, and re-run the audit to confirm.`
	);
}

// ---------------------------------------------------------------------------
// Axe scan + normalization
// ---------------------------------------------------------------------------

function targetToSelector(target: unknown): string {
	if (Array.isArray(target)) return target.map(String).join(' ');
	return String(target ?? '');
}

function extractContrast(
	node: Result['nodes'][number],
): ContrastData | undefined {
	if (node === undefined) return undefined;
	for (const check of [...node.any, ...node.all]) {
		if (check.id !== 'color-contrast' || typeof check.data !== 'object') {
			continue;
		}
		const data = check.data as Record<string, unknown>;
		const ratio =
			typeof data.contrastRatio === 'number' ? data.contrastRatio : undefined;
		if (ratio === undefined) continue;
		return {
			ratio,
			foreground: typeof data.fgColor === 'string' ? data.fgColor : undefined,
			background: typeof data.bgColor === 'string' ? data.bgColor : undefined,
			fontSize: typeof data.fontSize === 'string' ? data.fontSize : undefined,
			fontWeight:
				typeof data.fontWeight === 'string' ? data.fontWeight : undefined,
			expectedRatio:
				typeof data.expectedContrastRatio === 'string'
					? data.expectedContrastRatio
					: undefined,
		};
	}
	return undefined;
}

function normalizeViolation(result: Result): A11yViolation {
	return {
		id: result.id,
		impact: (result.impact ?? 'unknown') as A11yViolation['impact'],
		help: result.help,
		helpUrl: result.helpUrl,
		description: result.description,
		area: areaForRule(result.id),
		nodes: result.nodes.map((node) => ({
			selector: targetToSelector(node.target),
			html: node.html,
			failureSummary: node.failureSummary,
			contrast: CONTRAST_RULES.has(result.id)
				? extractContrast(node)
				: undefined,
		})),
	};
}

/**
 * Critical/serious filter — the severity gate used across the framework
 * (tests/a11y/login.a11y.spec.ts applies the same cut to raw axe results).
 * Accepts normalized violations or raw axe `Result` objects.
 */
export function blockers<T extends { impact?: ImpactValue | string }>(
	violations: readonly T[],
): T[] {
	return violations.filter(
		(v) => v.impact === 'critical' || v.impact === 'serious',
	);
}

/**
 * esbuild/tsx compatibility shim. When this module is consumed through
 * tsx (the CLIs), esbuild's keepNames transform rewrites the helper
 * functions inside page.evaluate callbacks to call a module-scope
 * `__name` helper — which does not exist in the browser, so the callback
 * throws `ReferenceError: __name is not defined`. (Playwright Test's own
 * transform does not inject it, which is why specs never see this.)
 * Installing a no-op `__name` global on the page before evaluating makes
 * the callbacks work under both transforms. The evaluate is a string so
 * it is itself immune to the transform.
 */
async function ensureEvaluateHelpers(page: Page): Promise<void> {
	await page.evaluate('globalThis.__name = globalThis.__name || ((fn) => fn);');
}

/** Run the axe scan alone (WCAG tags by default) and return raw results. */
export async function runAxeScan(
	page: Page,
	options: A11yOptions = {},
): Promise<AxeResults> {
	let builder = new AxeBuilder({ page }).withTags([
		...(options.tags ?? WCAG_TAGS),
	]);
	for (const selector of options.include ?? []) {
		builder = builder.include(selector);
	}
	for (const selector of options.exclude ?? []) {
		builder = builder.exclude(selector);
	}
	return builder.analyze();
}

/** Run axe restricted to a specific rule set (used by the focused checkers). */
async function runAxeRules(
	page: Page,
	ruleIds: string[],
	options: A11yOptions = {},
): Promise<A11yViolation[]> {
	let builder = new AxeBuilder({ page }).withRules(ruleIds);
	for (const selector of options.include ?? []) {
		builder = builder.include(selector);
	}
	for (const selector of options.exclude ?? []) {
		builder = builder.exclude(selector);
	}
	const results = await builder.analyze();
	return results.violations.map(normalizeViolation);
}

// ---------------------------------------------------------------------------
// Alt text checker
// ---------------------------------------------------------------------------

/** In-page inventory of image-like elements and their accessible names. */
async function inventoryMedia(page: Page): Promise<MediaItem[]> {
	return page.evaluate(() => {
		const selectorFor = (el: Element): string => {
			if (el.id) return `#${el.id}`;
			const tag = el.tagName.toLowerCase();
			const classes = Array.from(el.classList).slice(0, 2).join('.');
			const parent = el.parentElement;
			if (!parent) return tag;
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === el.tagName,
			);
			const nth =
				siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(el) + 1})` : '';
			const parentTag = parent.id
				? `#${parent.id}`
				: parent.tagName.toLowerCase();
			return `${parentTag} > ${tag}${classes ? `.${classes}` : ''}${nth}`;
		};
		const nameFromLabelledBy = (el: Element): string => {
			const ids = el.getAttribute('aria-labelledby');
			if (!ids) return '';
			return ids
				.split(/\s+/)
				.map((id) => document.getElementById(id)?.textContent ?? '')
				.join(' ')
				.trim();
		};
		const items: Array<{
			selector: string;
			tag: string;
			html: string;
			accessibleName: string;
			hasAccessibleName: boolean;
			decorative: boolean;
		}> = [];
		const push = (el: Element, name: string, decorative: boolean): void => {
			items.push({
				selector: selectorFor(el),
				tag: el.tagName.toLowerCase(),
				html: el.outerHTML.slice(0, 300),
				accessibleName: name,
				hasAccessibleName: name.trim().length > 0,
				decorative,
			});
		};
		for (const img of Array.from(document.querySelectorAll('img'))) {
			const alt = img.getAttribute('alt');
			const name =
				img.getAttribute('aria-label')?.trim() ||
				nameFromLabelledBy(img) ||
				alt?.trim() ||
				'';
			push(img, name, alt === '');
		}
		for (const input of Array.from(
			document.querySelectorAll('input[type="image"]'),
		)) {
			const name =
				input.getAttribute('aria-label')?.trim() ||
				nameFromLabelledBy(input) ||
				input.getAttribute('alt')?.trim() ||
				input.getAttribute('title')?.trim() ||
				'';
			push(input, name, false);
		}
		for (const el of Array.from(
			document.querySelectorAll('svg, [role="img"]'),
		)) {
			const role = el.getAttribute('role');
			const isSvg = el.tagName.toLowerCase() === 'svg';
			// A bare <svg> with no role is presentational markup, not content —
			// only inventory graphics that claim (or need) an image role.
			if (isSvg && role !== 'img') continue;
			const titleText =
				el.querySelector(':scope > title')?.textContent?.trim() ?? '';
			const name =
				el.getAttribute('aria-label')?.trim() ||
				nameFromLabelledBy(el) ||
				titleText;
			const decorative =
				el.getAttribute('aria-hidden') === 'true' ||
				el.getAttribute('role') === 'presentation' ||
				el.getAttribute('role') === 'none';
			push(el, name, decorative);
		}
		return items;
	});
}

/**
 * Alt-text check: axe's alt-related rules plus a DOM inventory of
 * img / input[type=image] / role=img graphics and whether each one
 * exposes an accessible name.
 */
export async function checkAltText(
	page: Page,
	options: A11yOptions = {},
	precomputed?: A11yViolation[],
): Promise<AltTextResult> {
	const violations =
		precomputed?.filter((v) => v.area === 'alt-text') ??
		(await runAxeRules(page, [...ALT_TEXT_RULES], options));
	await ensureEvaluateHelpers(page);
	const media = await inventoryMedia(page);
	const unnamed = media.filter((m) => !m.hasAccessibleName && !m.decorative);
	return { violations, media, unnamed };
}

// ---------------------------------------------------------------------------
// Form labels checker
// ---------------------------------------------------------------------------

/** In-page inventory of form controls and their accessible-name sources. */
async function inventoryFormControls(page: Page): Promise<FormControlItem[]> {
	return page.evaluate(() => {
		const selectorFor = (el: Element): string => {
			if (el.id) return `#${el.id}`;
			const tag = el.tagName.toLowerCase();
			const type = el instanceof HTMLInputElement ? `[type="${el.type}"]` : '';
			const name = el.getAttribute('name');
			const parent = el.parentElement;
			if (!parent) return `${tag}${type}`;
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === el.tagName,
			);
			const nth =
				siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(el) + 1})` : '';
			const parentTag = parent.id
				? `#${parent.id}`
				: parent.tagName.toLowerCase();
			return `${parentTag} > ${tag}${type}${name ? `[name="${name}"]` : ''}${nth}`;
		};
		const textOf = (el: Element | null): string =>
			(el?.textContent ?? '').replace(/\s+/g, ' ').trim();
		interface Found {
			selector: string;
			tag: string;
			type: string | null;
			accessibleName: string;
			hasAccessibleName: boolean;
			nameSource:
				| 'label'
				| 'aria-label'
				| 'aria-labelledby'
				| 'title'
				| 'text-content'
				| 'value'
				| 'none';
		}
		const controls: Found[] = [];
		const elements = Array.from(
			document.querySelectorAll('input, select, textarea, button'),
		);
		for (const el of elements) {
			const tag = el.tagName.toLowerCase();
			const type =
				el instanceof HTMLInputElement
					? el.type
					: tag === 'button'
						? el.getAttribute('type')
						: null;
			if (type === 'hidden') continue;
			let name = '';
			let source: Found['nameSource'] = 'none';
			const ariaLabel = el.getAttribute('aria-label')?.trim() ?? '';
			const labelledByIds = el.getAttribute('aria-labelledby');
			const labelledByText = labelledByIds
				? labelledByIds
						.split(/\s+/)
						.map((id) => textOf(document.getElementById(id)))
						.join(' ')
						.trim()
				: '';
			const labels: string[] = [];
			if (el.id) {
				for (const lab of Array.from(
					document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`),
				)) {
					const t = textOf(lab);
					if (t) labels.push(t);
				}
			}
			const wrappingLabel = el.closest('label');
			if (wrappingLabel) {
				const t = textOf(wrappingLabel);
				if (t) labels.push(t);
			}
			if (ariaLabel) {
				name = ariaLabel;
				source = 'aria-label';
			} else if (labelledByText) {
				name = labelledByText;
				source = 'aria-labelledby';
			} else if (labels.length > 0) {
				name = labels.join(' ');
				source = 'label';
			} else if (tag === 'button') {
				const t = textOf(el);
				if (t) {
					name = t;
					source = 'text-content';
				}
			} else if (
				el instanceof HTMLInputElement &&
				(el.type === 'submit' || el.type === 'button' || el.type === 'reset')
			) {
				const v = el.value.trim();
				if (v) {
					name = v;
					source = 'value';
				}
			}
			if (!name) {
				const title = el.getAttribute('title')?.trim() ?? '';
				if (title) {
					name = title;
					source = 'title';
				}
			}
			controls.push({
				selector: selectorFor(el),
				tag,
				type,
				accessibleName: name,
				hasAccessibleName: name.length > 0,
				nameSource: source,
			});
		}
		return controls;
	});
}

/**
 * Form-labels check: axe's label-related rules plus a DOM inventory of
 * every input/select/textarea/button and whether it has an accessible
 * name (label, aria-label, aria-labelledby, title, text, or value).
 */
export async function checkFormLabels(
	page: Page,
	options: A11yOptions = {},
	precomputed?: A11yViolation[],
): Promise<FormLabelsResult> {
	const violations =
		precomputed?.filter((v) => v.area === 'form-labels') ??
		(await runAxeRules(page, [...FORM_LABEL_RULES], options));
	await ensureEvaluateHelpers(page);
	const controls = await inventoryFormControls(page);
	const unlabeled = controls.filter((c) => !c.hasAccessibleName);
	return { violations, controls, unlabeled };
}

// ---------------------------------------------------------------------------
// Color contrast checker
// ---------------------------------------------------------------------------

/**
 * Color-contrast check: axe's color-contrast rules, with the measured
 * ratio / foreground / background attached to each reported node.
 * (Axe can only evaluate text whose effective background it can resolve;
 * text over images/gradients lands in axe's "incomplete" bucket, not here.)
 */
export async function checkColorContrast(
	page: Page,
	options: A11yOptions = {},
	precomputed?: A11yViolation[],
): Promise<ContrastResult> {
	const violations =
		precomputed?.filter((v) => v.area === 'contrast') ??
		(await runAxeRules(page, [...CONTRAST_RULES], options));
	return { violations };
}

// ---------------------------------------------------------------------------
// Keyboard navigation checker
// ---------------------------------------------------------------------------

interface ClickableCandidate {
	selector: string;
	reason: string;
}

/** In-page: elements that look clickable but are not in the tab order. */
async function findClickableNotFocusable(
	page: Page,
): Promise<ClickableCandidate[]> {
	return page.evaluate(() => {
		const selectorFor = (el: Element): string => {
			if (el.id) return `#${el.id}`;
			const tag = el.tagName.toLowerCase();
			const classes = Array.from(el.classList).slice(0, 2).join('.');
			const parent = el.parentElement;
			if (!parent) return tag;
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === el.tagName,
			);
			const nth =
				siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(el) + 1})` : '';
			const parentTag = parent.id
				? `#${parent.id}`
				: parent.tagName.toLowerCase();
			return `${parentTag} > ${tag}${classes ? `.${classes}` : ''}${nth}`;
		};
		const interactiveRoles = new Set([
			'button',
			'link',
			'tab',
			'menuitem',
			'switch',
			'checkbox',
			'radio',
			'option',
		]);
		const seen = new Set<string>();
		const found: Array<{ selector: string; reason: string }> = [];
		const add = (el: Element, reason: string): void => {
			const selector = selectorFor(el);
			if (seen.has(selector)) return;
			seen.add(selector);
			found.push({ selector, reason });
		};
		const htmlEl = (el: Element): HTMLElement => el as HTMLElement;
		for (const el of Array.from(document.querySelectorAll('*'))) {
			if (htmlEl(el).tabIndex >= 0) continue; // in the tab order already
			if (el.hasAttribute('onclick')) {
				add(el, 'has an inline onclick handler but no tabindex');
				continue;
			}
			const role = el.getAttribute('role');
			if (role && interactiveRoles.has(role)) {
				add(el, `has role="${role}" but no tabindex`);
				continue;
			}
			const style = window.getComputedStyle(el);
			if (
				style.cursor === 'pointer' &&
				el.querySelectorAll('a, button, input, select, textarea').length ===
					0 &&
				!el.closest('a, button')
			) {
				add(el, 'styled with cursor: pointer but is not keyboard-focusable');
			}
		}
		return found.slice(0, 50);
	});
}

interface ActiveElementInfo {
	selector: string;
	tag: string;
	role: string | null;
	text: string;
	visibleFocus: boolean;
	inMainContent: boolean;
}

/** Describe document.activeElement (focus indicator heuristic included). */
async function describeActiveElement(
	page: Page,
): Promise<ActiveElementInfo | null> {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body || el === document.documentElement) {
			return null;
		}
		const selectorFor = (node: Element): string => {
			if (node.id) return `#${node.id}`;
			const tag = node.tagName.toLowerCase();
			const classes = Array.from(node.classList).slice(0, 2).join('.');
			const parent = node.parentElement;
			if (!parent) return tag;
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === node.tagName,
			);
			const nth =
				siblings.length > 1
					? `:nth-of-type(${siblings.indexOf(node) + 1})`
					: '';
			const parentTag = parent.id
				? `#${parent.id}`
				: parent.tagName.toLowerCase();
			return `${parentTag} > ${tag}${classes ? `.${classes}` : ''}${nth}`;
		};
		const style = window.getComputedStyle(el);
		// Heuristic: a visible indicator means a non-none outline with real
		// width, or a box-shadow standing in for one. Background/border
		// swaps and underlines also exist in the wild — see docs for limits.
		const outlineVisible =
			style.outlineStyle !== 'none' &&
			Number.parseFloat(style.outlineWidth) > 0;
		const shadowVisible = style.boxShadow !== 'none' && style.boxShadow !== '';
		const text = (
			(el as HTMLElement).innerText ||
			(el as HTMLInputElement).value ||
			el.getAttribute('aria-label') ||
			el.textContent ||
			''
		)
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60);
		const implicitRole = (): string | null => {
			const tag = el.tagName.toLowerCase();
			if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
			if (tag === 'button') return 'button';
			if (tag === 'select') return 'combobox';
			if (tag === 'textarea') return 'textbox';
			if (tag === 'input') {
				const type = (el as HTMLInputElement).type;
				if (type === 'checkbox') return 'checkbox';
				if (type === 'radio') return 'radio';
				if (type === 'submit' || type === 'button') return 'button';
				return 'textbox';
			}
			return null;
		};
		return {
			selector: selectorFor(el),
			tag: el.tagName.toLowerCase(),
			role: el.getAttribute('role') ?? implicitRole(),
			text,
			visibleFocus: outlineVisible || shadowVisible,
			inMainContent:
				el.closest('main, [role="main"], form') !== null ||
				el.matches('main, [role="main"]'),
		};
	});
}

/**
 * Keyboard-navigation check — a programmatic Tab-walk:
 * presses Tab up to `maxTabStops` times, recording the focus order, and flags
 *   - clickable elements that never enter the tab order,
 *   - stops whose focus indicator is invisible (heuristic, see above),
 *   - a tab order that never reaches main content (main / role=main / form).
 * The walk stops when focus leaves the page or wraps to the first stop.
 */
export async function checkKeyboardNavigation(
	page: Page,
	options: A11yOptions = {},
): Promise<KeyboardResult> {
	const maxStops = options.maxTabStops ?? 50;
	const findings: KeyboardFinding[] = [];
	await ensureEvaluateHelpers(page);

	for (const candidate of await findClickableNotFocusable(page)) {
		findings.push({
			kind: 'clickable-not-focusable',
			selector: candidate.selector,
			message: `${candidate.selector} — ${candidate.reason}. Mouse users can click it; keyboard users can never reach it.`,
		});
	}

	// Reset focus to the top of the page before walking.
	await page.evaluate(() => {
		const active = document.activeElement as HTMLElement | null;
		active?.blur();
	});

	const stops: KeyboardStop[] = [];
	let reachedMainContent = false;
	for (let i = 0; i < maxStops; i++) {
		await page.keyboard.press('Tab');
		const info = await describeActiveElement(page);
		if (!info) break; // focus left the document (browser chrome / end)
		if (stops.length > 0 && info.selector === stops[0].selector) break; // wrapped
		stops.push({
			index: stops.length + 1,
			selector: info.selector,
			tag: info.tag,
			role: info.role,
			text: info.text,
			visibleFocus: info.visibleFocus,
		});
		if (info.inMainContent) reachedMainContent = true;
		if (!info.visibleFocus) {
			findings.push({
				kind: 'invisible-focus',
				selector: info.selector,
				message: `${info.selector} receives focus with no visible indicator (computed outline is none/absent and no box-shadow substitute was detected — heuristic). Keyboard users cannot see where they are.`,
			});
		}
	}

	if (stops.length === 0) {
		findings.push({
			kind: 'no-focusable-elements',
			message:
				'Tab never landed on any element — the page exposes nothing keyboard-focusable.',
		});
	} else if (!reachedMainContent) {
		findings.push({
			kind: 'main-content-not-reached',
			message:
				'The tab order never entered main content (a <main>, [role="main"], or <form> region) within the walked stops — keyboard users may be stuck in chrome/navigation or the content is unreachable.',
		});
	}

	return { stops, findings, reachedMainContent };
}

// ---------------------------------------------------------------------------
// Full audit
// ---------------------------------------------------------------------------

/**
 * Full accessibility audit of the page's current state: one axe scan
 * (WCAG A/AA tags) sliced into the four areas, plus the keyboard Tab-walk.
 * Navigate first — this audits whatever the page is showing now.
 */
export async function auditAccessibility(
	page: Page,
	options: A11yOptions = {},
): Promise<A11yAuditResult> {
	const axe = await runAxeScan(page, options);
	const violations = axe.violations.map(normalizeViolation);
	const altText = await checkAltText(page, options, violations);
	const formLabels = await checkFormLabels(page, options, violations);
	const contrast = await checkColorContrast(page, options, violations);
	const keyboard = await checkKeyboardNavigation(page, options);
	return {
		url: page.url(),
		finalUrl: page.url(),
		title: await page.title().catch(() => ''),
		httpStatus: null,
		axe,
		violations,
		altText,
		keyboard,
		contrast,
		formLabels,
	};
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

const AREA_TITLES: Record<A11yArea, string> = {
	'alt-text': 'Alt text',
	keyboard: 'Keyboard navigation',
	contrast: 'Color contrast',
	'form-labels': 'Form labels',
	general: 'Other axe findings',
};

function countByImpact(
	violations: A11yViolation[],
): Record<A11yImpact, number> {
	const counts: Record<A11yImpact, number> = {
		critical: 0,
		serious: 0,
		moderate: 0,
		minor: 0,
	};
	for (const v of violations) {
		if (v.impact !== 'unknown') counts[v.impact] += v.nodes.length;
	}
	return counts;
}

/** Total violation *nodes* across audits (findings counted per element). */
function totalNodes(violations: A11yViolation[]): number {
	return violations.reduce((n, v) => n + v.nodes.length, 0);
}

function mdCell(text: string): string {
	return text
		.replace(/\|/g, '\\|')
		.replace(/\s*\n\s*/g, ' ')
		.trim();
}

function htmlSnippet(html: string): string {
	const flat = html.replace(/\s+/g, ' ').trim();
	return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

function violationLines(violations: A11yViolation[]): string[] {
	const lines: string[] = [];
	for (const v of violations) {
		lines.push(
			`- **${v.id}** (${v.impact}) — ${v.help} [axe rule](${v.helpUrl})`,
		);
		lines.push(`  - Fix: ${fixGuidance(v)}`);
		for (const node of v.nodes) {
			const contrast = node.contrast
				? ` — contrast ${node.contrast.ratio}:1` +
					` (fg ${node.contrast.foreground ?? '?'}, bg ${node.contrast.background ?? '?'},` +
					` expected ${node.contrast.expectedRatio ?? '?'})`
				: '';
			lines.push(
				`  - \`${node.selector}\`${contrast} — \`${htmlSnippet(node.html)}\``,
			);
		}
	}
	return lines;
}

/**
 * Render one or more audits as a Markdown report: summary counts by
 * impact and by area up top, then a section per page with per-area
 * findings (rule id, help, node selector + HTML, plain-language fix).
 */
export function formatA11yReport(
	audits: A11yAuditResult[],
	generatedAt: Date = new Date(),
): string {
	const lines: string[] = [];
	lines.push('# Accessibility Audit Report');
	lines.push('');
	lines.push(`Generated: ${generatedAt.toISOString()}`);
	lines.push(
		'Benchmark: WCAG 2.1 AA (axe-core tags wcag2a, wcag2aa, wcag21a, wcag21aa). ' +
			'Severity gate: critical + serious findings are blockers.',
	);
	lines.push(
		'Note: automated checks cover only part of WCAG. A clean report is a floor, not a certification, and this report is not legal advice.',
	);
	lines.push('');

	// ---- Summary ----
	lines.push('## Summary');
	lines.push('');
	lines.push(
		'| Page | HTTP | Critical | Serious | Moderate | Minor | Blocker nodes |',
	);
	lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
	const allViolations: A11yViolation[] = [];
	for (const audit of audits) {
		allViolations.push(...audit.violations);
		const counts = countByImpact(audit.violations);
		const blockerCount = totalNodes(blockers(audit.violations));
		lines.push(
			`| ${mdCell(audit.url)} | ${audit.httpStatus ?? '—'} | ${counts.critical} | ${counts.serious} | ${counts.moderate} | ${counts.minor} | ${blockerCount} |`,
		);
	}
	lines.push('');
	const overall = countByImpact(allViolations);
	lines.push(
		`**Totals (violation nodes):** ${overall.critical} critical, ${overall.serious} serious, ` +
			`${overall.moderate} moderate, ${overall.minor} minor — ` +
			`${totalNodes(blockers(allViolations))} blocker node(s) across ${allViolations.length} rule(s)/page finding(s).`,
	);
	lines.push('');
	lines.push('**By area (violation nodes):**');
	for (const area of Object.keys(AREA_TITLES) as A11yArea[]) {
		const nodes = totalNodes(allViolations.filter((v) => v.area === area));
		if (nodes > 0) lines.push(`- ${AREA_TITLES[area]}: ${nodes}`);
	}
	const totalUnnamedMedia = audits.reduce(
		(n, a) => n + a.altText.unnamed.length,
		0,
	);
	const totalUnlabeled = audits.reduce(
		(n, a) => n + a.formLabels.unlabeled.length,
		0,
	);
	const totalKeyboardFindings = audits.reduce(
		(n, a) => n + a.keyboard.findings.length,
		0,
	);
	lines.push(
		`- DOM inventories: ${totalUnnamedMedia} media element(s) without an accessible name, ` +
			`${totalUnlabeled} form control(s) without an accessible name, ` +
			`${totalKeyboardFindings} keyboard finding(s).`,
	);
	lines.push('');

	// ---- Per-page sections ----
	for (const audit of audits) {
		lines.push(`## Page: ${audit.url}`);
		lines.push('');
		if (audit.finalUrl !== audit.url) {
			lines.push(`- Final URL: ${audit.finalUrl}`);
		}
		lines.push(
			`- HTTP status: ${audit.httpStatus ?? 'unknown'} · Title: ${audit.title || '(none)'}`,
		);
		if (audit.error) {
			lines.push(`- ⚠️ Audit error: ${audit.error}`);
		}
		const counts = countByImpact(audit.violations);
		lines.push(
			`- Axe violations: ${audit.violations.length} rule(s), ${totalNodes(audit.violations)} node(s) ` +
				`(critical ${counts.critical}, serious ${counts.serious}, moderate ${counts.moderate}, minor ${counts.minor})`,
		);
		lines.push('');

		// Alt text
		lines.push('### Alt text');
		lines.push('');
		if (audit.altText.violations.length > 0) {
			lines.push(...violationLines(audit.altText.violations));
		} else {
			lines.push('- No axe alt-text violations.');
		}
		lines.push(
			`- Media inventory: ${audit.altText.media.length} image-like element(s), ` +
				`${audit.altText.unnamed.length} without an accessible name.`,
		);
		for (const item of audit.altText.unnamed) {
			lines.push(
				`  - \`${item.selector}\` (\`${item.tag}\`) — \`${htmlSnippet(item.html)}\``,
			);
		}
		lines.push('');

		// Keyboard
		lines.push('### Keyboard navigation');
		lines.push('');
		lines.push(
			`- Tab stops walked: ${audit.keyboard.stops.length} · Reached main content: ${audit.keyboard.reachedMainContent ? 'yes' : 'no'}`,
		);
		if (audit.keyboard.stops.length > 0) {
			lines.push('');
			lines.push('| # | Element | Role | Text | Visible focus |');
			lines.push('| ---: | --- | --- | --- | --- |');
			for (const stop of audit.keyboard.stops) {
				lines.push(
					`| ${stop.index} | \`${mdCell(stop.selector)}\` | ${stop.role ?? '—'} | ${mdCell(stop.text) || '—'} | ${stop.visibleFocus ? 'yes' : 'NO'} |`,
				);
			}
		}
		if (audit.keyboard.findings.length > 0) {
			lines.push('');
			for (const finding of audit.keyboard.findings) {
				lines.push(`- ⚠️ [${finding.kind}] ${finding.message}`);
			}
		} else {
			lines.push('- No keyboard findings.');
		}
		lines.push('');

		// Contrast
		lines.push('### Color contrast');
		lines.push('');
		if (audit.contrast.violations.length > 0) {
			lines.push(...violationLines(audit.contrast.violations));
		} else {
			lines.push('- No axe color-contrast violations.');
		}
		lines.push('');

		// Form labels
		lines.push('### Form labels');
		lines.push('');
		if (audit.formLabels.violations.length > 0) {
			lines.push(...violationLines(audit.formLabels.violations));
		} else {
			lines.push('- No axe form-label violations.');
		}
		lines.push(
			`- Control inventory: ${audit.formLabels.controls.length} control(s), ` +
				`${audit.formLabels.unlabeled.length} without an accessible name.`,
		);
		for (const control of audit.formLabels.unlabeled) {
			lines.push(
				`  - \`${control.selector}\` (\`${control.tag}${control.type ? ` type=${control.type}` : ''}\`) — no accessible name`,
			);
		}
		lines.push('');

		// General
		const general = audit.violations.filter((v) => v.area === 'general');
		const keyboardAxe = audit.violations.filter((v) => v.area === 'keyboard');
		if (general.length > 0 || keyboardAxe.length > 0) {
			lines.push('### Other axe findings');
			lines.push('');
			if (keyboardAxe.length > 0) {
				lines.push(...violationLines(keyboardAxe));
			}
			if (general.length > 0) {
				lines.push(...violationLines(general));
			}
			lines.push('');
		}
	}

	return `${lines.join('\n')}\n`;
}
