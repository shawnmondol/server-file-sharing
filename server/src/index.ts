import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { AuthError } from './lib/auth.js';
import { sweepOrphanedUploads } from './lib/maintenance.js';
import { PathError } from './lib/paths.js';
import { pruneThumbnailCache, refreshRendererAvailability } from './lib/thumbnails.js';
import fileRoutes from './routes/files.js';
import sessionRoutes from './routes/session.js';
import textRoutes from './routes/text.js';
import transferRoutes from './routes/transfer.js';

const app = Fastify({
  logger: {
    level: config.isProduction ? 'info' : 'debug',
    transport: config.isProduction ? undefined : { target: 'pino-pretty' },
  },
  // Uploads stream to disk rather than buffering, so the body limit only
  // needs to cover JSON payloads.
  bodyLimit: 1024 * 1024,
  trustProxy: false,
});

app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  if (error instanceof PathError || error instanceof AuthError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  const status = error.statusCode ?? 500;
  if (status >= 500) request.log.error({ err: error }, 'request failed');

  // Above 500 the message may name internal paths, so send something generic.
  return reply.code(status).send({
    error: status >= 500 ? 'Something went wrong on the server' : error.message,
  });
});

await app.register(compress, {
  global: false, // Opt in per route; file bodies are already compressed.
});

await app.register(multipart, {
  limits: {
    fileSize: config.maxUploadBytes,
    files: 64,
    fields: 8,
  },
});

await app.register(sessionRoutes);
await app.register(fileRoutes);
await app.register(transferRoutes);
await app.register(textRoutes);

// --- Static frontend ---------------------------------------------------------
if (fs.existsSync(config.webDist)) {
  await app.register(fastifyStatic, {
    root: config.webDist,
    // Take over Cache-Control entirely; the built-in one would otherwise
    // overwrite whatever setHeaders assigns.
    cacheControl: false,
    // Hashed asset filenames can be cached hard; index.html and the service
    // worker are revalidated so a deploy takes effect on the next load.
    setHeaders(response, filePath) {
      const name = path.basename(filePath);
      const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
      response.setHeader(
        'Cache-Control',
        name === 'index.html' || name === 'sw.js'
          ? 'no-cache'
          : immutable
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
      );
    },
  });

  // Single-page app: anything that is not an API route or a real file falls
  // through to the shell, so a deep link like /?path=photos still boots.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(
    { expected: config.webDist },
    'No web build found — run `npm run build`. API routes are still available.',
  );
}

// --- Startup -----------------------------------------------------------------
async function start(): Promise<void> {
  await app.listen({ host: config.host, port: config.port });

  app.log.info(
    {
      shareRoot: config.shareRoot,
      authMode: config.authMode,
      allowedUsers: config.allowedUsers.length || 'any tailnet user',
      videoThumbnails: config.enableVideoThumbnails,
    },
    'file share ready',
  );

  if (config.authMode === 'none') {
    app.log.warn('AUTH_MODE=none — every request is treated as trusted. Development only.');
  }

  // Which renderers exist decides whether previously-failed thumbnails deserve
  // another try, so this runs before the other housekeeping — and before the
  // first gallery load has a chance to re-read a stale verdict.
  try {
    const renderers = await refreshRendererAvailability();
    app.log.info(
      { ffmpeg: renderers.ffmpeg, pdftoppm: renderers.pdftoppm },
      'thumbnail renderers detected',
    );
    if (!renderers.pdftoppm && config.enablePdfThumbnails) {
      app.log.warn(
        `pdftoppm not found at "${config.pdftoppmPath}" — PDFs will show a type badge instead of a first-page preview. ` +
          'Install poppler-utils, or set ENABLE_PDF_THUMBNAILS=false to silence this.',
      );
    }
    if (!renderers.ffmpeg && config.enableVideoThumbnails) {
      app.log.warn(
        `ffmpeg not found at "${config.ffmpegPath}" — videos will show a type badge instead of a poster frame. ` +
          'Install ffmpeg, or set ENABLE_VIDEO_THUMBNAILS=false to silence this.',
      );
    }
    if (renderers.cleared > 0) {
      app.log.info(
        { cleared: renderers.cleared },
        'renderer availability changed — cached thumbnail failures will be retried',
      );
    }
  } catch (error) {
    app.log.warn({ err: error }, 'renderer probe failed');
  }

  // Housekeeping runs after the listener is up so it never delays startup.
  void sweepOrphanedUploads()
    .then((count) => count > 0 && app.log.info({ count }, 'removed orphaned upload temp files'))
    .catch((error: unknown) => app.log.warn({ err: error }, 'upload sweep failed'));

  void pruneThumbnailCache()
    .then((count) => count > 0 && app.log.info({ count }, 'pruned stale thumbnails'))
    .catch((error: unknown) => app.log.warn({ err: error }, 'thumbnail prune failed'));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

try {
  await start();
} catch (error) {
  // A busy port is the one startup failure people actually hit — usually
  // another self-hosted app on the same Pi — so name the fix rather than
  // leaving them to decode an EADDRINUSE stack.
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    app.log.error(
      `Port ${config.port} on ${config.host} is already in use by another process. ` +
        'Set PORT in .env to a free port, then point `tailscale serve` at the new one.',
    );
  } else {
    app.log.error({ err: error }, 'failed to start');
  }
  process.exit(1);
}
