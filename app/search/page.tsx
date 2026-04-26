"use client";

import { useEffect, useState } from "react";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  source: string;
  href?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [hasLoadedUrlQuery, setHasLoadedUrlQuery] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();

    if (!trimmed) {
      setMessage("Enter a search term.");
      setResults([]);
      return;
    }

    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Search failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      const nextResults = Array.isArray(data.results) ? data.results : [];
      setResults(nextResults);

      if (nextResults.length === 0) {
        setMessage("No results found.");
      }
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Search crashed.",
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const urlQuery = new URLSearchParams(window.location.search).get("q") || "";
    setQuery(urlQuery);
    setHasLoadedUrlQuery(true);

    if (urlQuery.trim()) {
      runSearch(urlQuery);
    }
  }, []);

  return (
    <main style={{ padding: 40, maxWidth: 1000 }}>
      <h1>Search</h1>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          const trimmed = query.trim();

          if (!trimmed) return;

          window.history.replaceState(
            null,
            "",
            `/search?q=${encodeURIComponent(trimmed)}`
          );

          runSearch(trimmed);
        }}
        style={{ display: "flex", gap: 10, marginBottom: 24 }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, actors, directors, authors, artists..."
          style={{
            padding: 12,
            width: 520,
            maxWidth: "100%",
            border: "1px solid #ccc",
            borderRadius: 10,
          }}
        />

        <button
          type="submit"
          disabled={loading || !hasLoadedUrlQuery}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #222",
            background: "black",
            color: "white",
            fontWeight: 800,
            cursor: loading || !hasLoadedUrlQuery ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {message && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {message}
        </pre>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {results.map((result) => (
          <a
            key={result.id}
            href={result.href || "#"}
            style={{
              display: "block",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 14,
              textDecoration: "none",
              color: "inherit",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800 }}>{result.title}</div>
            <div style={{ color: "#555", marginTop: 4 }}>
              {result.subtitle}
            </div>
            <div style={{ color: "#777", fontSize: 13, marginTop: 6 }}>
              {result.type} · {result.source}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}