import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo, Fraunces, Big_Shoulders, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Presenta",
  description: "An Interactive Presentation Platform, by Officebanao",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${fraunces.variable} ${bigShoulders.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
