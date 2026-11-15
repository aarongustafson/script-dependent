# script-dependent

[![npm version](https://img.shields.io/npm/v/@aarongustafson/script-dependent.svg)](https://www.npmjs.com/package/@aarongustafson/script-dependent)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/script-dependent/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/script-dependent/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/script-dependent?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/script-dependent)
[![License](https://img.shields.io/npm/l/@aarongustafson/script-dependent)](https://github.com/aarongustafson/script-dependent/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/script-dependent)](https://github.com/aarongustafson/script-dependent/blob/main/index.d.ts)

A light-DOM web component that reveals authored content after an ES module
finishes evaluating and its optional initializer completes. Use it for controls
that would do nothing until their JavaScript is ready.

Author the wrapper with `hidden` and keep useful fallback content outside it.
If JavaScript is disabled, the component fails to load, or initialization fails,
the dependent controls stay hidden.

## Installation

```sh
npm install @aarongustafson/script-dependent
```

The package is in development and has not been published yet. CDN examples and
package badges depend on publication. Run the [local demo](./demo/index.html)
from an HTTP server while developing.

Import the package to register `<script-dependent>`:

```js
import '@aarongustafson/script-dependent';
```

Or load the registration module from an installed package:

```html
<script
  type="module"
  src="./node_modules/@aarongustafson/script-dependent/define.js"
></script>
```

Both entry points register the default tag automatically. The class-only import
does not:

```js
import { ScriptDependentElement } from '@aarongustafson/script-dependent/script-dependent.js';

customElements.define('script-dependent', ScriptDependentElement);
```

The package and `define.js` also export `defineScriptDependent(tagName?)`.
It leaves an existing definition alone; a custom name registers a subclass.
These are browser modules, not server-rendering entry points.

## Existing markup

```html
<p id="details">An ordinary explanation that works without JavaScript.</p>
<script-dependent script="./details.js" hidden>
  <button type="button">Read the explanation aloud</button>
</script-dependent>
```

The component imports `details.js`, waits for evaluation, then calls its
`initialize` export if present:

```js
// details.js
export function initialize(element, { signal }) {
  const button = element.querySelector('button');
  if (!('speechSynthesis' in window)) {
    throw new Error('Speech synthesis is unavailable.');
  }
  button.addEventListener(
    'click',
    () => {
      const text = document.querySelector('#details').textContent;
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    },
    { signal },
  );
}
```

The existing button is not replaced. Its identity, state, and any authored
listeners are preserved. For asynchronous setup, return a promise from
`initialize`; the wrapper stays hidden until that promise fulfills.

When no `initialize` export exists, successful module evaluation is enough.
An exported `initialize` that isn’t a function is a configuration error.
Only work awaited by module evaluation or the initializer counts as readiness:
starting unrelated asynchronous work does not delay reveal.

## Template content

```html
<p id="details">An explanation that works without JavaScript.</p>
<script-dependent script="./details.js" hidden>
  <template>
    <button type="button">Read the explanation aloud</button>
  </template>
</script-dependent>
```

After module evaluation succeeds, the wrapper replaces a single direct-child
template with a copy of its content, then initializes that content. More than
one direct-child template is an error. Nested templates remain inert.

Instantiation happens once per wrapper. Retry, reconnect, and source changes
reuse the resulting nodes. A failed initializer can leave partial changes in
that hidden content; it is responsible for making its setup repeatable.

## API

| API                           | Default                  | Behavior                                                                                                                                    |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `script` attribute/property   | `null`                   | Required HTTP(S) module URL, resolved against the document’s base URL. Setting the property to `null` or `undefined` removes the attribute. |
| `state` property              | `"idle"`                 | Read-only: `idle`, `loading`, `ready`, or `error`.                                                                                          |
| `retry()`                     | —                        | Starts another attempt when connected. Does nothing while disconnected.                                                                     |
| `data-script-dependent-state` | absent before connection | Component-owned state output for styling; not configuration.                                                                                |

### Events and messages

All events bubble and are composed:

| Event                      | Detail              | Meaning                                                                                                             |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `script-dependent:loading` | `{ script }`        | An attempt started; `script` is the authored value.                                                                 |
| `script-dependent:ready`   | `{ script }`        | Evaluation and initialization succeeded; `script` is the resolved URL.                                              |
| `script-dependent:error`   | `{ script, error }` | The current attempt failed. `script` is resolved when URL validation succeeded; otherwise it is the authored value. |

Listen before inserting the wrapper or importing its registration module if
you need the initial loading event. Error events expose the original error;
they do not automatically announce it or render a message.

The component generates no user-facing labels or messages. Author and translate
loading, failure, and recovery text outside the hidden region. The
[demo](./demo/index.html) shows visible status messages and an authored retry
button. A ready event describes initialization, not whether the author has
chosen to keep the wrapper hidden.

### Visibility ownership

- Include `hidden` in the initial HTML. CSS such as `:not(:defined)` does not
  cover the time between element definition and module readiness.
- The component owns `hidden` during loading and failure. Don’t change it
  during those states; use the events to manage separate fallback content.
- On the first successful attempt, the component removes `hidden`.
- Once ready, authors can hide or show the wrapper. If it is hidden when a
  retry, source change, or disconnect starts, that choice is preserved on
  subsequent success. Authors can show it again when ready.
- Do not use `hidden="until-found"` for this gate, or override the browser’s
  hiding behavior with CSS. This is a readiness aid, not a security boundary.

### Cleanup, cancellation, and recovery

Each connected wrapper initializes independently. Browsers can share a module’s
evaluation, but the component calls `initialize` for each wrapper and attempt.

A source change, retry, or disconnect aborts the previous initializer’s signal.
Use that signal to remove listeners, cancel cooperative work, and undo
initializer-owned effects. No return-value cleanup function is called.

Import itself cannot be canceled. The component ignores stale results after
source changes or disconnects. Initializers must also respect the signal:
the component cannot undo arbitrary changes made by application code.
Disconnect hides the wrapper and returns it to `idle`; reconnect starts a new
attempt, preserving entered data and the instantiated nodes.

`retry()` starts initialization again but does not cache-bust module URLs.
The browser’s normal module cache applies, including cached evaluation failures.
Fix the module or use a deliberately changed URL when appropriate. The component
does not observe ordinary script tags, poll for globals, retry automatically,
or impose an initialization timeout.

## Styling and accessibility

No shadow DOM, component stylesheet, CSS custom properties, or shadow parts
are used. Style the wrapper and its contents with ordinary CSS:

```css
script-dependent {
  display: block;
}

script-dependent[hidden] {
  display: none;
}
```

Keep essential information, native form fields, and ordinary navigation outside
the gate when possible. The component adds no roles, tab stops, live regions,
or focus movement. Revealing content leaves focus where it was.

Hiding focused content can remove its focus. Before retrying or changing the
source of a gate containing focus, place focus on an appropriate recovery
control outside it. Use restrained status announcements rather than announcing
every internal state change.

## Security and browser requirements

The `script` URL executes code with the page’s privileges. Use trusted,
author-controlled URLs; never populate it directly from untrusted input.
Only HTTP and HTTPS sources are accepted. Relative URLs use `document.baseURI`,
including an authored `base` element.

Cross-origin modules require CORS permission and valid JavaScript MIME types.
The page’s Content Security Policy must permit the module and its dependencies.
Top-level evaluation, network, CSP, MIME, and initializer failures all keep the
gate hidden and emit an error event.

Modern browsers need Custom Elements, dynamic import, promises, and
`AbortController`. Without support, authored hidden markup and outside
fallbacks remain. Test the actual content and task with keyboard and assistive
technology; this wrapper cannot make arbitrary content accessible.

## Development

```sh
npm ci
npm run test:run
npm run test:types
npm run lint
npx playwright install chromium firefox webkit
npm run test:browser
```

The browser suite covers real module loading, both markup patterns, failure,
keyboard/focus behavior, no-JavaScript fallbacks, reflow, and the shared
system-color demo styles. Emulated forced colors are not a substitute for
testing Windows High Contrast or assistive technology.

The starter’s `version` and `postversion` scripts are retained: versioning
updates and stages the versioned ESM demo, creates the normal npm version
commit/tag, and pushes tags afterward. Do not run versioning or publication
without release approval.

## License

[MIT](./LICENSE)
