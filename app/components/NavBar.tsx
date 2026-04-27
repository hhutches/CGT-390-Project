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
        color: "inherit",
        textDecoration: "none",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

function writeCachedUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;

  try {
    if (user) {
      window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    } else {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

export default function NavBar() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() =>
    readCachedUser()
  );
  const [authChecked, setAuthChecked] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await safeJson(res);
        const nextUser = res.ok && data?.user ? (data.user as CurrentUser) : null;

        if (!cancelled) {
          setCurrentUser(nextUser);
          writeCachedUser(nextUser);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          writeCachedUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
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
        padding: "12px 28px",
        borderBottom: "1px solid #ddd",
        display: "grid",
        gridTemplateColumns: "auto minmax(260px, 520px) auto",
        alignItems: "center",
        gap: 20,
        background: "white",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <NavLink href="/" label="Home" />
        <NavLink href="/feed" label="Feed" />
        <NavLink href="/add-entry" label="Add Entry" />
        <NavLink href="/favorites" label="Favorites" />
        <NavLink href="/friends" label="Friends" />
      </div>

      <form onSubmit={submitSearch} style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, actors, directors, authors, artists..."
          style={{
            width: "100%",
            padding: "9px 12px",
            border: "1px solid #ccc",
            borderRadius: 999,
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          style={{
            padding: "9px 14px",
            border: "1px solid #222",
            borderRadius: 999,
            background: "black",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "flex-end",
          minHeight: 22,
        }}
      >
        {currentUser ? (
          <>
            <NavLink
              href={`/profiles/${currentUser.username}`}
              label={currentUser.displayName || `@${currentUser.username}`}
            />
            <NavLink href="/logout" label="Log Out" />
          </>
        ) : authChecked ? (
          <>
            <NavLink href="/login" label="Log In" />
            <NavLink href="/signup" label="Sign Up" />
          </>
        ) : null}
      </div>
    </nav>
  );
}