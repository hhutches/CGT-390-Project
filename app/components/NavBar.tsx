"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
};

const AUTH_CACHE_KEY = "media_app_current_user_cache";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        color: "#111",
        textDecoration: "none",
        fontWeight: 700,
        whiteSpace: "nowrap",
        fontSize: 15,
        padding: "9px 11px",
        borderRadius: 8,
      }}
    >
      {label}
    </Link>
  );
}

function readCachedUser() {
  if (typeof window === "undefined") return null;

  try {
    const cached = window.sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;

    return JSON.parse(cached) as CurrentUser | null;
  } catch {
    return null;
  }
}

export default function NavBar() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCurrentUser(readCachedUser());

    function handleAuthChanged() {
      setCurrentUser(readCachedUser());
    }

    window.addEventListener("media-app-auth-changed", handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);

    return () => {
      window.removeEventListener("media-app-auth-changed", handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
    };
  }, []);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) return;

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <nav
      style={{
        padding: "16px 48px",
        borderBottom: "3px solid #ff7f7a",
        display: "grid",
        gridTemplateColumns: "auto minmax(280px, 560px) auto",
        alignItems: "center",
        gap: 24,
        background: "#ffe2df",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#111",
            textDecoration: "none",
            fontWeight: 900,
            fontSize: 24,
            marginRight: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #ffd6d4",
          }}
        >
          MediaApp
        </Link>

        <NavLink href="/" label="Home" />
        <NavLink href="/add-entry" label="Add Entry" />
        <NavLink href="/favorites" label="Favorites" />
        <NavLink href="/friends" label="Friends" />
      </div>

      <form
        onSubmit={submitSearch}
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, people, authors, artists..."
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #f0b7b3",
            borderRadius: 8,
            fontSize: 14,
            background: "#fff",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "12px 16px",
            border: "1px solid #ff7f7a",
            borderRadius: 8,
            background: "#ff7f7a",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          minHeight: 22,
          flexWrap: "wrap",
        }}
      >
        {currentUser ? (
          <>
            <Link
              href={`/profiles/${currentUser.username}`}
              style={{
                color: "#111",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                padding: "9px 12px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #ffd6d4",
              }}
            >
              Profile
            </Link>

            <Link
              href="/logout"
              style={{
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                padding: "9px 12px",
                borderRadius: 8,
                background: "#ff7f7a",
              }}
            >
              Log Out
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/login"
              style={{
                color: "#111",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                padding: "9px 12px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #ffd6d4",
              }}
            >
              Log In
            </Link>

            <Link
              href="/signup"
              style={{
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                padding: "10px 14px",
                borderRadius: 8,
                background: "#ff7f7a",
              }}
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
