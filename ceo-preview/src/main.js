// Public RABBIT CEO preview is DEMO-only. Ignore all query parameters.
// No HTTP provider, private account data or real trading connection is permitted.
import { createApp } from './app.js';
import { createProvider } from './data/provider.js';
const app = createApp({ root: document.getElementById('root'), provider: createProvider('') });
globalThis.__rabbit = app;
app.start();
