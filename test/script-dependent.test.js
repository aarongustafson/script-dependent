import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScriptDependentElement } from '../script-dependent.js';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function gate(markup = '<button type="button">Action</button>') {
	const element = document.createElement('script-dependent');
	element.hidden = true;
	element.script = '/module.js';
	element.innerHTML = markup;
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('readiness', () => {
	it('preserves actual light-DOM nodes and reveals only after initialization', async () => {
		let finish;
		const initialize = vi.fn(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({
			initialize,
		});
		const element = gate();
		const button = element.firstElementChild;
		const click = vi.fn();
		button.addEventListener('click', click);
		const states = [];
		for (const name of ['loading', 'ready'])
			element.addEventListener(`script-dependent:${name}`, () =>
				states.push(element.state),
			);
		document.body.append(element);
		await settle();
		expect(element.hidden).toBe(true);
		expect(element.state).toBe('loading');
		expect(initialize).toHaveBeenCalledWith(element, {
			signal: expect.any(AbortSignal),
		});
		finish();
		await settle();
		expect(element.hidden).toBe(false);
		expect(element.state).toBe('ready');
		expect(states).toEqual(['loading', 'ready']);
		expect(element.firstElementChild).toBe(button);
		expect(element.shadowRoot).toBeNull();
		button.click();
		expect(click).toHaveBeenCalledOnce();
	});

	it('reveals after evaluation without an initializer and resolves against document baseURI', async () => {
		const load = vi
			.spyOn(ScriptDependentElement, '_importModule')
			.mockResolvedValue({});
		const element = gate();
		element.script = './module.js';
		document.body.append(element);
		await settle();
		expect(load).toHaveBeenCalledWith(
			new URL('./module.js', document.baseURI).href,
		);
		expect(element.state).toBe('ready');
		expect(element.hidden).toBe(false);
	});

	for (const module of [{ initialize: false }, { initialize: null }]) {
		it('reports a non-callable initializer as a configuration failure', async () => {
			vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue(
				module,
			);
			const element = gate();
			const error = vi.fn();
			element.addEventListener('script-dependent:error', error);
			document.body.append(element);
			await settle();
			expect(element.hidden).toBe(true);
			expect(element.state).toBe('error');
			expect(error.mock.calls[0][0].detail.error).toBeInstanceOf(
				TypeError,
			);
		});
	}

	for (const phase of ['import', 'initialize']) {
		it(`keeps content hidden and exposes ${phase} rejection`, async () => {
			const failure = new Error('Failure');
			const load = vi.spyOn(ScriptDependentElement, '_importModule');
			if (phase === 'import') load.mockRejectedValue(failure);
			else
				load.mockResolvedValue({
					initialize: () => {
						throw failure;
					},
				});
			const element = gate();
			const error = vi.fn();
			element.addEventListener('script-dependent:error', error);
			document.body.append(element);
			await settle();
			expect(element.hidden).toBe(true);
			expect(element.state).toBe('error');
			expect(error).toHaveBeenCalledOnce();
			expect(error.mock.calls[0][0].detail.error).toBe(failure);
		});
	}

	for (const script of [
		null,
		'',
		'   ',
		'javascript:alert(1)',
		'data:text/javascript,export{}',
		'file:///module.js',
	]) {
		it(`rejects invalid source ${script}`, async () => {
			const load = vi.spyOn(ScriptDependentElement, '_importModule');
			const element = gate();
			element.script = script;
			const error = vi.fn();
			element.addEventListener('script-dependent:error', error);
			document.body.append(element);
			await settle();
			expect(element.hidden).toBe(true);
			expect(element.state).toBe('error');
			expect(error).toHaveBeenCalledOnce();
			expect(load).not.toHaveBeenCalled();
		});
	}
});

describe('templates and lifecycle', () => {
	it('materializes a direct template once before initialization and leaves nested templates inert', async () => {
		let initialized = 0;
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({
			initialize(element) {
				expect(element.querySelector('button')).not.toBeNull();
				expect(element.querySelector('template')).not.toBeNull();
				initialized++;
			},
		});
		const element = gate(
			'<template><button>Action</button><div><template><p>Nested</p></template></div></template>',
		);
		document.body.append(element);
		await settle();
		const button = element.querySelector('button');
		element.remove();
		document.body.append(element);
		await settle();
		expect(element.querySelector('button')).toBe(button);
		expect(element.querySelectorAll('button')).toHaveLength(1);
		expect(element.querySelector('p')).toBeNull();
		expect(initialized).toBe(2);
	});

	it('rejects ambiguous direct templates without consuming either', async () => {
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({});
		const element = gate(
			'<template>One</template><template>Two</template>',
		);
		document.body.append(element);
		await settle();
		expect(element.state).toBe('error');
		expect(element.querySelectorAll('template')).toHaveLength(2);
	});

	it('aborts on source changes and ignores stale success or failure', async () => {
		let finish;
		let signal;
		const initialize = vi.fn((element, options) => {
			signal = options.signal;
			return new Promise((resolve) => {
				finish = resolve;
			});
		});
		vi.spyOn(ScriptDependentElement, '_importModule')
			.mockResolvedValueOnce({ initialize })
			.mockResolvedValueOnce({
				initialize: () => Promise.reject(new Error('Current failure')),
			});
		const element = gate();
		document.body.append(element);
		await settle();
		element.script = '/other.js';
		expect(signal.aborted).toBe(true);
		await settle();
		finish();
		await settle();
		expect(element.state).toBe('error');
		expect(element.hidden).toBe(true);
	});

	it('ignores a stale rejected import after a newer source becomes ready', async () => {
		let reject;
		vi.spyOn(ScriptDependentElement, '_importModule')
			.mockImplementationOnce(
				() =>
					new Promise((resolve, fail) => {
						reject = fail;
					}),
			)
			.mockResolvedValueOnce({});
		const element = gate();
		const error = vi.fn();
		element.addEventListener('script-dependent:error', error);
		document.body.append(element);
		await settle();
		element.script = '/new.js';
		await settle();
		reject(new Error('Stale failure'));
		await settle();
		expect(element.state).toBe('ready');
		expect(element.hidden).toBe(false);
		expect(error).not.toHaveBeenCalled();
	});

	it('aborts cooperative work on disconnect and does not reveal detached content', async () => {
		let finish;
		let signal;
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({
			initialize(element, options) {
				signal = options.signal;
				return new Promise((resolve) => {
					finish = resolve;
				});
			},
		});
		const element = gate();
		document.body.append(element);
		await settle();
		element.remove();
		finish();
		await settle();
		expect(signal.aborted).toBe(true);
		expect(element.state).toBe('idle');
		expect(element.hidden).toBe(true);
	});

	it('initializes each wrapper separately and retries failures without duplicating markup', async () => {
		const initialize = vi
			.fn()
			.mockRejectedValueOnce(new Error('Temporary'))
			.mockResolvedValue(undefined);
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({
			initialize,
		});
		const first = gate('<template><button>Action</button></template>');
		document.body.append(first);
		await settle();
		expect(first.state).toBe('error');
		first.retry();
		const second = gate();
		document.body.append(second);
		await settle();
		expect(first.state).toBe('ready');
		expect(second.state).toBe('ready');
		expect(first.querySelectorAll('button')).toHaveLength(1);
		expect(initialize).toHaveBeenCalledTimes(3);
	});

	it('preserves an author hiding ready content across retries and reconnects', async () => {
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({});
		const element = gate();
		document.body.append(element);
		await settle();
		element.hidden = true;
		element.retry();
		await settle();
		expect(element.state).toBe('ready');
		expect(element.hidden).toBe(true);
		element.remove();
		document.body.append(element);
		await settle();
		expect(element.hidden).toBe(true);
	});

	it('reflects script properties and upgrades a pre-definition property', async () => {
		vi.spyOn(ScriptDependentElement, '_importModule').mockResolvedValue({});
		class LateGate extends ScriptDependentElement {}
		const element = document.createElement('late-script-dependent');
		element.script = '/late.js';
		document.body.append(element);
		customElements.define('late-script-dependent', LateGate);
		await settle();
		expect(element.getAttribute('script')).toBe('/late.js');
		element.script = null;
		expect(element.hasAttribute('script')).toBe(false);
	});
});
