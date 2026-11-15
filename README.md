# script-dependent Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/script-dependent.svg)](https://www.npmjs.com/package/@aarongustafson/script-dependent)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/script-dependent/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/script-dependent/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/script-dependent?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/script-dependent)
[![License](https://img.shields.io/npm/l/@aarongustafson/script-dependent)](https://github.com/aarongustafson/script-dependent/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/script-dependent)](https://github.com/aarongustafson/script-dependent/blob/main/script-dependent.d.ts)

Reveals authored content only after its module and optional initializer are ready.

## Demo

[Live Demo](https://aarongustafson.github.io/script-dependent/demo/) ([Source](./demo/index.html))

Additional demos:

- [ESM CDN Demo](https://aarongustafson.github.io/script-dependent/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/script-dependent/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/script-dependent
```

## Usage

### Option 1: Auto-define the custom element (easiest)

Import the package to automatically define the `<script-dependent>` custom element:

```javascript
import '@aarongustafson/script-dependent';
```

Or use the define-only script in HTML:

```html
<script
	src="./node_modules/@aarongustafson/script-dependent/define.js"
	type="module"
></script>
```

### Option 2: Import the class and define manually

Import the class and define the custom element with your preferred tag name:

```javascript
import { ScriptDependentElement } from '@aarongustafson/script-dependent/script-dependent.js';

customElements.define('my-custom-name', ScriptDependentElement);
```

### Basic Example

```html
<script-dependent>
	<!-- Your content here -->
</script-dependent>
```

## Attributes

| Attribute           | Type     | Default | Description                  |
| ------------------- | -------- | ------- | ---------------------------- |
| `example-attribute` | `string` | `""`    | Description of the attribute |

## Events

The component fires custom events that you can listen to:

| Event                  | Description                  | Detail     |
| ---------------------- | ---------------------------- | ---------- |
| `script-dependent:event` | Fired when something happens | `{ data }` |

### Example Event Handling

```javascript
const element = document.querySelector('script-dependent');

element.addEventListener('script-dependent:event', (event) => {
	console.log('Event fired:', event.detail);
});
```

## CSS Custom Properties

| Property          | Default | Description            |
| ----------------- | ------- | ---------------------- |
| `--example-color` | `#000`  | Example color property |

### Example Styling

```css
script-dependent {
	--example-color: #ff0000;
}
```

## Browser Support

This component uses modern web standards:

- Custom Elements v1
- Shadow DOM v1
- ES Modules

For older browsers, you may need polyfills.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Install browser engines and check demo colors, focus, and layout
npx playwright install chromium firefox webkit
npm run test:browser

# Lint code
npm run lint

# Format code
npm run format

# View demo
open demo/index.html
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
