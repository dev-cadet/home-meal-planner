import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { config } from "../config";
import { getDatabase, type Database } from "../db/client";
import * as schema from "../db/schema";
import {
  attachInviteToUser,
  evaluateRegistration,
  promoteFirstUser,
} from "./registration";

/** Header carrying an invite code through sign-up. */
export const INVITE_HEADER = "x-invite-code";

const SIGN_UP_PATH = "/sign-up/email";

export interface AuthOptions {
  allowRegistration?: boolean;
  disableSignups?: boolean;
  secret?: string;
  baseURL?: string;
}

/**
 * Enforced at the point of use rather than in the config schema, so the data
 * layer and its tests stay runnable without auth configured.
 */
function requireSecret(explicit?: string): string {
  const secret = explicit ?? config.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to start the auth server.\n" +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return secret;
}

/**
 * Build an auth instance bound to a specific database.
 *
 * A factory rather than a bare singleton so tests can exercise the real
 * sign-up and sign-in flows — including the registration gate — against a
 * throwaway database.
 */
export function createAuth(db: Database, options: AuthOptions = {}) {
  const allowRegistration = options.allowRegistration ?? config.ALLOW_REGISTRATION;
  const disableSignups = options.disableSignups ?? config.DISABLE_SIGNUPS;

  return betterAuth({
    appName: "Home Meal Planner",
    secret: requireSecret(options.secret),
    baseURL: options.baseURL ?? config.BETTER_AUTH_URL ?? "http://localhost:3000",

    database: drizzleAdapter(db, { provider: "sqlite", schema }),

    emailAndPassword: {
      enabled: true,
      // No SMTP, so a verification mail could never be delivered.
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: 10,
    },

    user: {
      additionalFields: {
        /**
         * `input: false` is load-bearing. Without it, anyone could POST
         * `isAdmin: true` to the public sign-up endpoint and mint themselves
         * an admin account. Promotion happens server-side in the after-hook.
         */
        isAdmin: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        /** Also `input: false` — only an admin reset may ever set this. */
        mustChangePassword: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh at most daily
    },

    advanced: {
      cookiePrefix: "hmp",
    },

    hooks: {
      /**
       * The registration gate.
       *
       * Better Auth runs hooks for HTTP requests *and* server-side
       * `auth.api.*` calls, so this is a single chokepoint that cannot be
       * walked around by invoking the API directly from a Server Action.
       */
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_UP_PATH) return;

        const outcome = await evaluateRegistration({
          db,
          inviteCode: ctx.headers?.get(INVITE_HEADER),
          allowRegistration,
          disableSignups,
        });

        if (!outcome.allowed) {
          throw new APIError("FORBIDDEN", {
            code: outcome.reason.toUpperCase(),
            message: outcome.message,
          });
        }
      }),

      /** Promote the first account; record who redeemed an invite. */
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_UP_PATH) return;

        const returned = ctx.context?.returned as
          | { user?: { id?: string } }
          | undefined;
        const userId = returned?.user?.id;
        if (!userId) return;

        await promoteFirstUser(db, userId);

        const code = ctx.headers?.get(INVITE_HEADER)?.trim();
        if (code) await attachInviteToUser(db, code, userId);
      }),
    },

    plugins: [
      // Must stay last: flushes Set-Cookie through Next's async cookie API.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Application singleton, resolved lazily.
 *
 * Deliberately *not* a top-level `await`: that opened a database connection at
 * module import, and Next's build imports every route module across ~20
 * parallel workers to collect page data. Twenty processes racing to open the
 * same SQLite file and set `journal_mode` produced SQLITE_BUSY and failed the
 * build. Connecting on first use keeps it to the processes that actually
 * serve requests.
 */
let cached: Auth | undefined;

export async function getAuth(): Promise<Auth> {
  cached ??= createAuth((await getDatabase()).db);
  return cached;
}

export type Session = Auth["$Infer"]["Session"];
