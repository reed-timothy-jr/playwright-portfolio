#!/usr/bin/env tsx
/**
 * PowerBase scaffold CLI — turns a recon AppModel into page objects and
 * smoke specs you review, rename, and promote.
 *
 * Usage:
 *   npm run scaffold -- --model app-model.json [--force]
 *
 * Writes to src/pages/generated/ and tests/e2e/generated/. Existing files
 * are never overwritten unless --force is passed. Every file is stamped
 * GENERATED — the framework scaffolds, the engineer decides.
 */
import { readFile } from 'node:fs/promises';
import {
	generateFromModel,
	writeGenerated,
} from '../src/support/recon/generator';
import { parseAppModel } from '../src/support/recon/model';

function arg(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	return idx === -1 ? undefined : process.argv[idx + 1];
}

function flag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
	const modelPath = arg('model');
	if (!modelPath) {
		console.error('Missing model. Provide --model <app-model.json>.');
		process.exit(1);
	}
	const raw = await readFile(modelPath, 'utf8');
	const model = parseAppModel(JSON.parse(raw) as unknown);
	const command = `npm run scaffold -- --model ${modelPath}`;
	const files = generateFromModel(model, command, {
		force: flag('force'),
	});
	const { written, skipped } = await writeGenerated(files, process.cwd(), {
		force: flag('force'),
	});

	for (const f of written) console.log(`  wrote   ${f}`);
	for (const f of skipped)
		console.log(`  skipped ${f} (exists — use --force to overwrite)`);

	console.log(
		`\nScaffold complete: ${written.length} written, ${skipped.length} skipped.`,
	);
	console.log(
		'Review the generated files, move the keepers out of generated/, and delete the rest.',
	);
}

main().catch((error) => {
	console.error('Scaffold failed:', error);
	process.exit(1);
});
