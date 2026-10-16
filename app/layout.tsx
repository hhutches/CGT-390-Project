import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: "Movie Mood · Media Logger",
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
    >
      <body
        style={{
          margin: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          background: "#fafafa",
        }}
      >
        <NavBar />

        <main
          style={{
            padding: 20,
            maxWidth: "none",
            margin: 0,
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
