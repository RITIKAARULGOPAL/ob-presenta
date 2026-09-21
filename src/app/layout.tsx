import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Geist, Geist_Mono, Archivo, Fraunces, Big_Shoulders, Playfair_Display, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// The three alternate display faces a deck's Typography picker can switch to
// (see src/lib/fonts.ts) — loaded here, once, at build time like Archivo above,
// since next/font/google needs a static import per family rather than a
// runtime family name. Each gets its own CSS variable; switching between them
// is just which variable a slide's --font-archivo resolves to (SlideRenderer).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800"],
});

// Body-face choices (Typography → Body Font). Geist itself needs no separate
// load — it's already above — these two are the alternates.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Presenta",
  description: "An Interactive Presentation Platform, by Officebanao",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is what every colour in globals.css hangs off. The server has
    // no way to know which one this visitor wants, so it renders light and the
    // script below corrects it while the HTML is still parsing — before the
    // first paint, which is the difference between "dark mode" and "dark mode
    // after a white flash". suppressHydrationWarning is what lets React accept
    // the attribute the script wrote instead of re-asserting the one in JSX.
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${fraunces.variable} ${bigShoulders.variable} ${playfairDisplay.variable} ${plexSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
