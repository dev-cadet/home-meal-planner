import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { todayInAppTimeZone } from "@/lib/date";
import {
  FESTIVE_ENABLED_COOKIE,
  FESTIVE_OPT_OUT_COOKIE,
  PALETTE_COOKIE,
  paletteAttribute,
} from "@/lib/theme/cookies";
import { resolvePaletteId } from "@/lib/theme/resolve";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Home Meal Planner",
  description: "Plan meals for the week and turn them into a shopping list.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read server-side so `data-palette` is in the very first HTML the browser
  // parses. Deciding after hydration would flash the wrong palette. The
  // precedence logic itself is pure and unit-tested — see
  // `lib/theme/resolve.ts` — this is just the cookie-jar/env glue around it.
  const jar = await cookies();
  const paletteId = resolvePaletteId(
    {
      palette: jar.get(PALETTE_COOKIE)?.value,
      festiveEnabled: jar.get(FESTIVE_ENABLED_COOKIE)?.value,
      festiveOptOut: jar.get(FESTIVE_OPT_OUT_COOKIE)?.value,
    },
    todayInAppTimeZone(),
  );

  return (
    <html
      lang="en"
      {...paletteAttribute(paletteId)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
