import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.route(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/**',
		(route) => route.abort(),
	);
});

const root = fileURLToPath(new URL('../../', import.meta.url));
let server;
let origin;
test.beforeAll(async () => {
	server = createServer(async (request, response) => {
		const path = resolve(
			root,
			`.${new URL(request.url, 'http://localhost').pathname}`,
		);
		if (!path.startsWith(`${resolve(root)}${sep}`)) {
			response.writeHead(403).end();
			return;
		}
		try {
			const content = await readFile(path);
			response.setHeader(
				'Content-Type',
				{
					'.html': 'text/html',
					'.js': 'text/javascript',
					'.css': 'text/css',
				}[extname(path)] || 'application/octet-stream',
			);
			response.end(content);
		} catch (error) {
			response
				.writeHead(error.code === 'ENOENT' ? 404 : 500)
				.end(error.message);
		}
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
	await new Promise((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
});

test('class-only import is inert and real cached modules initialize per wrapper with cleanup', async ({
	page,
}) => {
	await page.route('**/blank.html', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><title>Module lifecycle</title><body></body>',
		}),
	);
	await page.route('**/shared-module.js', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
		globalThis.evaluations = (globalThis.evaluations || 0) + 1;
		export function initialize(element, {signal}) {
			globalThis.initializations = (globalThis.initializations || 0) + 1;
			element.querySelector('button').addEventListener('click', () => {
				element.querySelector('output').value = String(Number(element.querySelector('output').value) + 1);
			}, {signal});
		}
	`,
		}),
	);
	await page.goto(`${origin}/blank.html`);
	const registered = await page.evaluate(async () => {
		const { ScriptDependentElement } = await import(
			new URL('/script-dependent.js', location.href).href
		);
		const before = customElements.get('script-dependent');
		await import(new URL('/index.js', location.href).href);
		return {
			before: Boolean(before),
			after:
				customElements.get('script-dependent') ===
				ScriptDependentElement,
		};
	});
	expect(registered).toEqual({ before: false, after: true });
	await page.evaluate(() => {
		for (const id of ['one', 'two']) {
			const gate = document.createElement('script-dependent');
			gate.id = id;
			gate.hidden = true;
			gate.script = '/shared-module.js';
			gate.innerHTML =
				'<button>Increment</button><output>0</output><input value="Original">';
			document.body.append(gate);
		}
	});
	await expect(page.locator('#one')).toBeVisible();
	await expect(page.locator('#two')).toBeVisible();
	expect(
		await page.evaluate(() => ({
			evaluations: globalThis.evaluations,
			initializations: globalThis.initializations,
		})),
	).toEqual({ evaluations: 1, initializations: 2 });
	await page.locator('#one input').fill('Keep this');
	await page.evaluate(() => document.querySelector('#one').retry());
	await expect(page.locator('#one')).toBeVisible();
	await page.locator('#one button').click();
	await expect(page.locator('#one output')).toHaveText('1');
	await expect(page.locator('#one input')).toHaveValue('Keep this');
	await page.evaluate(() => {
		const gate = document.querySelector('#one');
		gate.remove();
		document.body.append(gate);
	});
	await expect(page.locator('#one')).toBeVisible();
	await page.locator('#one button').click();
	await expect(page.locator('#one output')).toHaveText('2');
	expect(await page.evaluate(() => globalThis.evaluations)).toBe(1);
});

test('real failed and stale imports cannot reveal the wrong content', async ({
	page,
}) => {
	await page.goto(`${origin}/demo/index.html`);
	await expect(page.locator('#existing')).toBeVisible();
	await page.evaluate(() => {
		globalThis.gateErrors = 0;
		document
			.querySelector('#existing')
			.addEventListener('script-dependent:error', () => {
				globalThis.gateErrors++;
			});
		document.querySelector('#existing').script = '/missing-module.js';
	});
	await expect(page.locator('#existing')).toHaveAttribute(
		'data-script-dependent-state',
		'error',
	);
	await expect(page.locator('#existing')).toBeHidden();
	expect(await page.evaluate(() => globalThis.gateErrors)).toBe(1);
	let release;
	let requested;
	const requestSeen = new Promise((resolve) => {
		requested = resolve;
	});
	const blocked = new Promise((resolve) => {
		release = resolve;
	});
	await page.route('**/slow-module.js', async (route) => {
		requested();
		await blocked;
		await route.fulfill({
			contentType: 'text/javascript',
			body: 'globalThis.slowEvaluated = true; export function initialize(element) { element.dataset.stale = "yes"; }',
		});
	});
	await page.evaluate(() => {
		document.querySelector('#existing').script = '/slow-module.js';
	});
	await requestSeen;
	await page.evaluate(() => {
		document.querySelector('#existing').script = '/demo/word-count.js';
	});
	await expect(page.locator('#existing')).toBeVisible();
	const evaluated = page.waitForResponse('**/slow-module.js');
	release();
	await evaluated;
	await expect
		.poll(() => page.evaluate(() => globalThis.slowEvaluated))
		.toBe(true);
	await expect(page.locator('#existing')).toHaveAttribute(
		'data-script-dependent-state',
		'ready',
	);
	await expect(page.locator('#existing')).not.toHaveAttribute('data-stale');
	expect(await page.evaluate(() => globalThis.gateErrors)).toBe(1);
});

test('real modules gate existing and template controls without moving focus', async ({
	page,
	browserName,
}) => {
	let release;
	const blocked = new Promise((resolve) => {
		release = resolve;
	});
	await page.route('**/word-count.js', async (route) => {
		await blocked;
		await route.continue();
	});
	await page.goto(`${origin}/demo/index.html`, {
		waitUntil: 'domcontentloaded',
	});
	await expect(page.locator('#existing')).toBeHidden();
	await expect(page.locator('#templated button')).toHaveCount(0);
	await page.locator('#existing-text').focus();
	release();
	await expect(page.locator('#existing')).toHaveAttribute(
		'data-script-dependent-state',
		'ready',
	);
	await expect(page.locator('#templated')).toHaveAttribute(
		'data-script-dependent-state',
		'ready',
	);
	await expect(page.locator('#existing-text')).toBeFocused();
	await page.locator('#existing-text').fill('Three small words');
	await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	await expect(page.locator('#existing button')).toBeFocused();
	const outline = await page
		.locator('#existing button')
		.evaluate((button) => getComputedStyle(button).outlineStyle);
	expect(outline).not.toBe('none');
	await page.keyboard.press('Enter');
	await expect(page.locator('#existing output')).toHaveText('3');
	await expect(page.locator('#failure')).toBeHidden();
	await expect(page.locator('#failure-status')).toContainText('could not');
	await expect(page.locator('#retry')).toBeVisible();
	await page.locator('#retry').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#failure')).toHaveAttribute(
		'data-script-dependent-state',
		'error',
	);
	await expect(page.locator('#retry')).toBeFocused();
});

test('no JavaScript retains useful fields/fallbacks without dead controls', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto(`${origin}/demo/index.html`);
		await expect(page.locator('#existing-text')).toBeVisible();
		await page
			.locator('#existing-text')
			.fill('Draft survives without enhancement');
		for (const button of await page
			.locator('script-dependent button')
			.all())
			await expect(button).toBeHidden();
		await expect(page.locator('noscript p')).toBeVisible();
		await expect(page.locator('noscript p')).toContainText(
			'The word counter needs JavaScript.',
		);
	} finally {
		await context.close();
	}
});

test('demo reflows and keeps code/live order in light, dark and forced colors', async ({
	page,
}) => {
	for (const scheme of ['light', 'dark']) {
		await page.emulateMedia({ colorScheme: scheme });
		await page.goto(`${origin}/demo/index.html`);
		await expect(page.locator('#existing')).toBeVisible();
		const [code, live] = await Promise.all([
			page
				.locator('.code-demo-pair')
				.first()
				.locator('pre')
				.boundingBox(),
			page
				.locator('.code-demo-pair')
				.first()
				.locator('.demo')
				.boundingBox(),
		]);
		expect(code.x).toBeLessThan(live.x);
	}
	await page.emulateMedia({
		forcedColors: 'active',
		reducedMotion: 'reduce',
	});
	await page.setViewportSize({ width: 320, height: 800 });
	await expect(page.locator('#existing button')).toBeVisible();
	const layout = await page.evaluate(() => {
		const pair = document.querySelector('.code-demo-pair');
		return {
			width: document.documentElement.scrollWidth,
			code: pair.querySelector('pre').getBoundingClientRect().bottom,
			live: pair.querySelector('.demo').getBoundingClientRect().top,
		};
	});
	expect(layout.width).toBeLessThanOrEqual(320);
	expect(layout.code).toBeLessThanOrEqual(layout.live);
});
