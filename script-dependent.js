/**
 * Reveals light-DOM content after module evaluation and optional initialization.
 * @element script-dependent
 * @attr {string} script - HTTP(S) module URL, resolved against document.baseURI.
 * @fires script-dependent:loading - A new readiness attempt has started.
 * @fires script-dependent:ready - Module evaluation and initialization succeeded.
 * @fires script-dependent:error - The current readiness attempt failed.
 */
export class ScriptDependentElement extends HTMLElement {
	static get observedAttributes() {
		return ['script'];
	}

	constructor() {
		super();
		this._state = 'idle';
		this._controller = null;
		this._connected = false;
		this._materialized = false;
		this._preserveHidden = false;
	}

	get script() {
		return this.getAttribute('script');
	}

	set script(value) {
		if (value === null || value === undefined)
			this.removeAttribute('script');
		else this.setAttribute('script', String(value));
	}

	get state() {
		return this._state;
	}

	connectedCallback() {
		if (Object.hasOwn(this, 'script')) {
			const value = this.script;
			delete this.script;
			this.script = value;
		}
		this._connected = true;
		this._begin();
	}

	disconnectedCallback() {
		this._connected = false;
		if (this._state === 'ready')
			this._preserveHidden = this.hasAttribute('hidden');
		const previous = this._controller;
		this._controller = null;
		previous?.abort();
		this.hidden = true;
		this._setState('idle');
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue !== newValue && this._connected) this._begin();
	}

	/** Starts a new attempt when connected; does not bypass the module cache. */
	retry() {
		if (this._connected) this._begin();
	}

	_setState(state) {
		this._state = state;
		this.setAttribute('data-script-dependent-state', state);
	}

	_current(controller) {
		return (
			this.isConnected &&
			this._controller === controller &&
			!controller.signal.aborted
		);
	}

	_begin() {
		if (this._state === 'ready')
			this._preserveHidden = this.hasAttribute('hidden');
		const previous = this._controller;
		const controller = new AbortController();
		this._controller = controller;
		previous?.abort();
		if (!this._current(controller)) return;
		this.hidden = true;
		this._setState('loading');
		this._emit('loading', { script: this.script });
		if (!this._current(controller)) return;
		if (this.ownerDocument.readyState === 'loading') {
			this.ownerDocument.addEventListener(
				'DOMContentLoaded',
				() => this._run(controller),
				{
					once: true,
					signal: controller.signal,
				},
			);
		} else {
			queueMicrotask(() => this._run(controller));
		}
	}

	static _importModule(url) {
		return import(/* @vite-ignore */ url);
	}

	async _run(controller) {
		if (!this._current(controller)) return;
		let script = this.script;
		try {
			if (!script?.trim())
				throw new TypeError('A nonempty script attribute is required.');
			const url = new URL(script, this.ownerDocument.baseURI);
			if (!['https:', 'http:'].includes(url.protocol)) {
				throw new TypeError('The script URL must use HTTP or HTTPS.');
			}
			script = url.href;
			const module = await this.constructor._importModule(script);
			if (!this._current(controller)) return;
			if (
				Object.hasOwn(module, 'initialize') &&
				typeof module.initialize !== 'function'
			) {
				throw new TypeError(
					'The initialize export must be a function.',
				);
			}
			if (!this._materialized) {
				const templates = [...this.children].filter(
					(child) => child.localName === 'template',
				);
				if (templates.length > 1)
					throw new TypeError(
						'Use at most one direct-child template.',
					);
				if (templates.length)
					templates[0].replaceWith(
						this.ownerDocument.importNode(
							templates[0].content,
							true,
						),
					);
				this._materialized = true;
			}
			if (!this._current(controller)) return;
			if (module.initialize)
				await module.initialize(this, { signal: controller.signal });
			if (!this._current(controller)) return;
			if (!this._preserveHidden) this.removeAttribute('hidden');
			this._setState('ready');
			this._emit('ready', { script });
		} catch (error) {
			if (!this._current(controller)) return;
			this.hidden = true;
			this._setState('error');
			this._emit('error', { script, error });
		}
	}

	_emit(name, detail) {
		this.dispatchEvent(
			new CustomEvent(`script-dependent:${name}`, {
				bubbles: true,
				composed: true,
				detail,
			}),
		);
	}
}
