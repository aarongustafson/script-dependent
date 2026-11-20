import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

it('trims block-edge margins inside demo sections', () => {
	expect(readFileSync('demo/demo-shell.css', 'utf8')).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});

describe('published API and automation', () => {
	it('keeps auto-registration separate from the class-only module', async () => {
		const { ScriptDependentElement } =
			await import('../script-dependent.js');
		const { defineScriptDependent } = await import('../define.js');
		expect(defineScriptDependent('registered-gate')).toBe(true);
		expect(document.createElement('registered-gate')).toBeInstanceOf(
			ScriptDependentElement,
		);
		expect(defineScriptDependent('registered-gate')).toBe(true);
	});

	it('documents attributes, state, retry, events, inheritance and registration exports', () => {
		const manifest = json('custom-elements.json');
		const element = manifest.modules.find(
			(module) => module.path === 'script-dependent.js',
		).declarations[0];
		expect(element.superclass.name).toBe('HTMLElement');
		expect(element.attributes.map((attribute) => attribute.name)).toContain(
			'script',
		);
		expect(element.members.map((member) => member.name)).toEqual(
			expect.arrayContaining(['script', 'state', 'retry']),
		);
		expect(element.events.map((event) => event.name).sort()).toEqual([
			'script-dependent:error',
			'script-dependent:loading',
			'script-dependent:ready',
		]);
		expect(
			manifest.modules
				.find((module) => module.path === 'define.js')
				.exports.map((entry) => entry.name),
		).toContain('defineScriptDependent');
	});

	it('packs every runtime/types/manifest entry and preserves release scripts', () => {
		const pkg = json('package.json');
		expect(pkg.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(pkg.scripts.postversion).toBe('git push --follow-tags');
		const before = readFileSync('demo/esm.html', 'utf8');
		execFileSync(process.execPath, ['scripts/update-demo-versions.js']);
		expect(readFileSync('demo/esm.html', 'utf8')).toBe(before);
		const [pack] = JSON.parse(
			execFileSync(
				'npm',
				['pack', '--dry-run', '--json', '--ignore-scripts'],
				{ encoding: 'utf8' },
			),
		);
		const files = pack.files.map((file) => file.path);
		for (const file of [
			'index.js',
			'index.d.ts',
			'define.js',
			'define.d.ts',
			'script-dependent.js',
			'script-dependent.d.ts',
			'custom-elements.json',
		])
			expect(files).toContain(file);
		expect(
			files.some(
				(file) => file.startsWith('test/') || file.startsWith('demo/'),
			),
		).toBe(false);
	});
});
