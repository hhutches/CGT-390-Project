import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Media App",
  description: "Track and review movies, shows, and more",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        style={{
          margin: 0,
          fontFamily: "var(--font-geist-sans)",
          background: "#fafafa",
        }}
      >
        <NavBar />

        <main
          style={{
            padding: 20,
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}