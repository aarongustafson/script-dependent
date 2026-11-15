import { ScriptDependentElement } from './script-dependent.js';

export function defineScriptDependent(tagName = 'script-dependent') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(
			tagName,
			tagName === 'script-dependent'
				? ScriptDependentElement
				: class extends ScriptDependentElement {},
		);
	}

	return true;
}

defineScriptDependent();
