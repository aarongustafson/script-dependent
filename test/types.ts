import { ScriptDependentElement, defineScriptDependent } from '../index.js';
import type {
	ScriptDependentModule,
	ScriptDependentState,
} from '../script-dependent.js';
import { defineScriptDependent as register } from '../define.js';

const element = document.createElement('script-dependent');
const typed: ScriptDependentElement = element;
typed.script = './module.js';
typed.script = undefined;
const state: ScriptDependentState = typed.state;
typed.retry();
const registered: boolean = defineScriptDependent();
register();
const module: ScriptDependentModule = {
	async initialize(gate, { signal }) {
		gate.addEventListener('click', () => {}, { signal });
	},
};
element.addEventListener('script-dependent:error', (event) => {
	const error: unknown = event.detail.error;
	const source: string | null = event.detail.script;
	void error;
	void source;
});
void module;
void state;
void registered;
