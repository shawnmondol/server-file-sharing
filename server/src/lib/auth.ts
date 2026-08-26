import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

export interface Identity {
  login: string;
  displayName: string;
  profilePic: string | null;
  canWrite: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity;
  }
}

/**
 * `tailscale serve` terminates TLS on the Pi and proxies to us over loopback,
 * injecting the caller's tailnet identity. It strips these headers from
 * inbound requests, so a client cannot forge them — but only if the request
 * really did come from the local proxy, which is what the loopback check
 * below enforces.
 */
const LOGIN_HEADER = 'tailscale-user-login';
const NAME_HEADER = 'tailscale-user-name';
const PIC_HEADER = 'tailscale-user-profile-pic';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function canWrite(login: string): boolean {
  if (config.writeUsers.length === 0) return true;
  return config.writeUsers.includes(login.toLowerCase());
}

export class AuthError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}

export function identify(request: FastifyRequest): Identity {
  if (config.authMode === 'none') {
    return { login: 'local', displayName: 'Local user', profilePic: null, canWrite: true };
  }

  if (!LOOPBACK.has(request.socket.remoteAddress ?? '')) {
    throw new AuthError('Requests must arrive through the local Tailscale proxy', 403);
  }

  const login = first(request.headers[LOGIN_HEADER]);
  if (!login) {
    throw new AuthError('No Tailscale identity on this request', 401);
  }

  const normalized = login.toLowerCase();
  if (config.allowedUsers.length > 0 && !config.allowedUsers.includes(normalized)) {
    throw new AuthError('This tailnet account is not allowed to use the share', 403);
  }

  return {
    login: normalized,
    displayName: first(request.headers[NAME_HEADER]) ?? login,
    profilePic: first(request.headers[PIC_HEADER]),
    canWrite: canWrite(normalized),
  };
}

/** Attach the caller's identity, rejecting anyone who cannot be identified. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  request.identity = identify(request);
}

/** Guard for the mutating routes: upload, delete, new folder. */
export async function requireWrite(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.identity.canWrite) {
    throw new AuthError('Your account has read-only access to the share', 403);
  }
}
