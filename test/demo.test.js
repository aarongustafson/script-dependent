import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('shows authored failure UI and the JavaScript that updates and reveals it', async () => {
	const page = document.createElement('template');
	page.innerHTML = await readFile('demo/index.html', 'utf8');
	const liveGate = page.content.querySelector('#failure');
	const section = liveGate.closest('section');
	const example = document.createElement('template');
	example.innerHTML = section.querySelector('pre code').textContent;
	for (const content of [section, example.content]) {
		const gate = content.querySelector('#failure');
		const status = content.querySelector('#failure-status');
		const retry = content.querySelector('#retry');
		expect(gate).not.toBeNull();
		expect(status?.getAttribute('role')).toBe('status');
		expect(status?.textContent.trim()).toBe(
			'The ordinary text field is always available.',
		);
		expect(retry?.hidden).toBe(true);
		expect(retry?.textContent.trim()).toBe('Try again');
		expect(gate.contains(status)).toBe(false);
		expect(gate.contains(retry)).toBe(false);
	}
	const script = example.content.querySelector(
		'script[type="module"]',
	)?.textContent;
	expect(script).toContain("gate.addEventListener('script-dependent:error'");
	expect(script).toContain('status.textContent');
	expect(script).toMatch(/retry\.hidden\s*=\s*false/);
	expect(script).toContain('gate.retry()');
});
