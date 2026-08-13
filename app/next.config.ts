import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emits `.next/standalone` with a self-contained server and only the traced
   * node_modules, which is what keeps the runtime image small.
   */
  output: "standalone",

  /**
   * Both load platform-specific native binaries. Bundling them would break the
   * `require` that resolves the right `.node` file, so they stay external and
   * are copied in by file tracing instead.
   */
  serverExternalPackages: ["@libsql/client", "libsql", "sharp"],

  /**
   * Hosts allowed to request dev-only assets. **Development only** — this key
   * has no effect on a production build, so it changes nothing about Docker.
   *
   * Without it, opening the dev server from a phone on the LAN serves the HTML
   * and CSS but 403s every `/_next/static/chunks/*.js` request. The page looks
   * completely fine and nothing hydrates, so every button in the app silently
   * does nothing while native controls keep working — which reads like a dozen
   * unrelated UI bugs rather than one blocked request.
   *
   * Private ranges rather than a fixed address, because DHCP reassigns it.
   * `*.local` covers Bonjour hostnames. Public origins are still refused, which
   * is the part of the protection that matters.
   */
  allowedDevOrigins: ["192.168.*.*"],

  experimental: {
    // Enables forbidden() and unauthorized() for the DAL (docs/plan.md §2).
    authInterrupts: true,

    // 2MB image + multipart overhead + form fields. Next's default is 1MB,
    // which would silently reject every photo upload (docs/plan.md §5).
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
