import type { FastifyInstance } from 'fastify';
import os from 'node:os';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/filetypes.js';
import { diskUsage } from '../lib/library.js';

export default async function sessionRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Unauthenticated liveness probe. The PWA polls this to tell "the tailnet
   * dropped" apart from "the server is broken", which drives the offline
   * banner, so it must not itself require an identity.
   */
  app.get('/api/health', async () => ({ ok: true, time: Date.now() }));

  app.get('/api/session', { preHandler: requireAuth }, async (request) => {
    const disk = await diskUsage();
    return {
      user: {
        login: request.identity.login,
        displayName: request.identity.displayName,
        profilePic: request.identity.profilePic,
        canWrite: request.identity.canWrite,
      },
      server: {
        hostname: os.hostname(),
        // The absolute share path is deliberately not exposed: it leaks the
        // account name of whoever runs the service.
        maxUploadBytes: config.maxUploadBytes,
        videoThumbnails: config.enableVideoThumbnails,
      },
      disk,
      categories: CATEGORY_ORDER.map((category) => ({ category, label: CATEGORY_LABELS[category] })),
    };
  });
}
