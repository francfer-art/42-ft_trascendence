import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import createUserRoutes from './routes/createUser.routes';
import howToPlayRoutes from './routes/howToPlay.routes';
import { createTranslationsRouter } from './routes/translations.routes';
import { TranslationsJsonModel } from './models/local-file-system/translations.model';
// import { TranslationsPrismaModel } from './models/prisma/translations.prisma.model';
import { socketAuth } from './utils/sockets/socket.auth';
import { registerSocialHandlers } from './utils/sockets/social/social.handlers';
import { registerSystemHandlers } from './utils/sockets/system/system.handlers';
import { registerGameHandlers } from './utils/sockets/game/game.handlers';
import { setSocketServer } from './utils/sockets/socket.server';
import { createVillainRouter } from './routes/villain.routes';
import { createCardRouter } from './routes/card.routes';
// import { VillainJsonModel } from './models/local-file-system/villain.model';
import { VillainPrismaModel } from './models/prisma/villain.prisma.model';
import { CardPrismaModel } from './models/prisma/card.prisma.model';
import { UPLOADS_DIR } from './utils/uploads';

const app = express();

app.use(
  cors({
    origin: ['http://localhost', 'http://localhost:5173'],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const api = express.Router();

api.use('/assets', express.static(resolve(process.cwd(), 'assets')));
api.use('/uploads', express.static(UPLOADS_DIR));

api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/conversations', chatRoutes);
api.use('/signup', createUserRoutes);
api.use('/how-to-play', howToPlayRoutes);
api.use('/translations', createTranslationsRouter(TranslationsJsonModel));
api.use('/villains', createVillainRouter(VillainPrismaModel));
api.use('/cards', createCardRouter(CardPrismaModel));

// The frontend always calls the API under /api
app.use('/api', api);

// FRONTEND_DIST is set by the production image (root Dockerfile): this server
// then also serves the built frontend, so the whole app runs on a single origin.
const frontendDist = process.env.FRONTEND_DIST
  ? resolve(process.env.FRONTEND_DIST)
  : null;

if (frontendDist) {
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(
    '/assets',
    express.static(join(frontendDist, 'assets'), {
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use(express.static(frontendDist));
  // Page navigations to client-side routes (/home, /profile/...) are handled by
  // React Router; any other missing file is still a 404
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')) {
      return next();
    }

    res.sendFile(join(frontendDist, 'index.html'));
  });
} else {
  // docker-compose: nginx strips the /api prefix before proxying here
  app.use(api);
}

const PORT = Number(process.env.PORT) || 3000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});
setSocketServer(io);
io.use(socketAuth);
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('auth:check', () => {
    console.log('[Socket Auth] Check:', {
      socketId: socket.id,
      authenticated: !!socket.data.user,
      userId: socket.data.user?.id,
      user: socket.data.user,
    });

    socket.emit('auth:result', {
      authenticated: !!socket.data.user,
      userId: socket.data.user?.id,
    });
  });
  registerSocialHandlers(io, socket);
  registerSystemHandlers(io, socket);
  registerGameHandlers(io, socket);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});
