import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../.env') });

// Import the app only after .env is loaded so JWT, MongoDB and CORS settings
// are available while the Express modules are initialized.
const { app } = await import('./src/app.js');
const port = Number(process.env.PORT || 5000);

if (process.env.VERCEL !== '1') {
  app.listen(port, () => console.log(`[FSG API] Listening on http://localhost:${port}`));
}

export default app;
