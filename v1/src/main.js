import { createApp } from './app.js';
import { createProvider } from './data/provider.js';
const app = createApp({ root: document.getElementById('root'), provider: createProvider(location.search) });
globalThis.__rabbit = app;           // handy for debugging and for the smoke tests
app.start();
