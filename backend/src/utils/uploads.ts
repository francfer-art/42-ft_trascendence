import { resolve } from 'node:path';

// Folder where user avatars are stored. Defaults to backend/uploads; the
// production image points it to a persistent volume when there is one.
export const UPLOADS_DIR = resolve(
  process.cwd(),
  process.env.UPLOADS_DIR ?? 'uploads',
);
