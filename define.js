import { ScriptDependentElement } from './script-dependent.js';

export function defineComponentName(tagName = 'script-dependent') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, ScriptDependentElement);
	}

	return true;
}

defineComponentName();
