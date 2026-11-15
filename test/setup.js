import { beforeAll } from 'vitest';
import { ScriptDependentElement } from '../script-dependent.js';

const elementName = 'script-dependent'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, ScriptDependentElement);
	}

	// Make the class available globally for testing static methods
	globalThis.ScriptDependentElement = ScriptDependentElement;
});
