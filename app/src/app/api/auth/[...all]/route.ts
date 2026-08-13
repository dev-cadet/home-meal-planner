import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

/**
 * `auth` is resolved lazily (see lib/auth/index.ts), so the handler is built
 * per request rather than at module import — which is what keeps Next's build
 * workers from all opening the database at once.
 */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(await getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(await getAuth()).POST(request);
}
