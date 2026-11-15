import { defineScriptDependent } from '@aarongustafson/script-dependent/define.js';

const registered: boolean = defineScriptDependent();
const element = document.createElement('script-dependent');
element.script = './module.js';
element.script = undefined;
const state: 'idle' | 'loading' | 'ready' | 'error' = element.state;
element.retry();
document.querySelector('script-dependent')?.retry();

element.addEventListener('script-dependent:loading', (event) => {
	const source: string | null = event.detail.script;
	void source;
});
element.addEventListener('script-dependent:ready', (event) => {
	const source: string | null = event.detail.script;
	void source;
});
element.addEventListener('script-dependent:error', (event) => {
	const error: unknown = event.detail.error;
	const source: string | null = event.detail.script;
	void error;
	void source;
});

void registered;
void state;
