"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        color: "inherit",
        textDecoration: "none",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </a>
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

export default function NavBar() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await safeJson(res);

        if (res.ok && data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setLoaded(true);
      }
    }

    loadCurrentUser();
  }, []);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) return;

    window.location.href = `/search?q=${encodeURIComponent(trimmed)}`;
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
        }}
      >
        {!loaded ? (
          <span style={{ color: "#777" }}>Loading...</span>
        ) : currentUser ? (
          <>
            <NavLink
              href={`/profiles/${currentUser.username}`}
              label={currentUser.displayName || `@${currentUser.username}`}
            />
            <NavLink href="/logout" label="Log Out" />
          </>
        ) : (
          <>
            <NavLink href="/login" label="Log In" />
            <NavLink href="/signup" label="Sign Up" />
          </>
        )}
      </div>
    </nav>
  );
}