export const PALETTE_COOKIE = "hmp.palette";
export const FESTIVE_ENABLED_COOKIE = "hmp.festive-enabled";
export const FESTIVE_OPT_OUT_COOKIE = "hmp.festive-opt-out";

/**
 * The active palette is stored in a cookie rather than localStorage so the
 * server can stamp `data-palette` on `<html>` during SSR — see
 * `app/layout.tsx`. With localStorage the correct value is only known after
 * hydration, which means a flash of the wrong palette on every page load.
 */
export function paletteAttribute(id: string): Record<string, string> {
  return { "data-palette": id };
}
