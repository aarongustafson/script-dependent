export type ScriptDependentState = 'idle' | 'loading' | 'ready' | 'error';

export interface ScriptDependentDetail {
	script: string | null;
}

export interface ScriptDependentErrorDetail extends ScriptDependentDetail {
	error: unknown;
}

export interface ScriptDependentModule {
	initialize?(
		element: ScriptDependentElement,
		options: { signal: AbortSignal },
	): void | Promise<void>;
}

export class ScriptDependentElement extends HTMLElement {
	static readonly observedAttributes: string[];
	get script(): string | null;
	set script(value: string | null | undefined);
	readonly state: ScriptDependentState;
	retry(): void;
	connectedCallback(): void;
	disconnectedCallback(): void;
	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;
}

declare global {
	interface HTMLElementTagNameMap {
		'script-dependent': ScriptDependentElement;
	}
	interface HTMLElementEventMap {
		'script-dependent:loading': CustomEvent<ScriptDependentDetail>;
		'script-dependent:ready': CustomEvent<ScriptDependentDetail>;
		'script-dependent:error': CustomEvent<ScriptDependentErrorDetail>;
	}
}
