"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  source: string;
  href: string;
  coverUrl: string | null;
  provider?: string | null;
  externalId?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Response was not valid JSON.",
      raw: text,
    };
  }
}

function getTypeLabel(type: string) {
  if (type === "MOVIE") return "Movie";
  if (type === "SHOW") return "Show";
  if (type === "BOOK") return "Book";
  if (type === "ALBUM") return "Album";
  if (type === "GAME") return "Game";
  if (type === "PERSON") return "Person";
  return type;
}

function getActionLabel(result: SearchResult) {
  if (result.provider && result.provider !== "LOCAL") {
    return "Import / View";
  }

  if (result.type === "PERSON") {
    return "Search Person";
  }

  return "View Media";
}

function ResultCover({ result }: { result: SearchResult }) {
  if (result.type === "ALBUM") {
    return (
      <div
        style={{
          width: 140,
          height: 210,
          border: "1px solid #ddd",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 35,
            padding: "5px 7px",
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
            color: "#444",
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          {result.subtitle.split(" · ")[0] || "Unknown Artist"}
        </div>

        <div
          style={{
            width: 140,
            height: 140,
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {result.coverUrl ? (
            <img
              src={result.coverUrl}
              alt={result.title}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "#666" }}>No cover</span>
          )}
        </div>

        <div
          style={{
            height: 35,
            padding: "5px 7px",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
          }}
        >
          {result.title}
        </div>
      </div>
    );
  }

  if (result.coverUrl) {
    return (
      <img
        src={result.coverUrl}
        alt={result.title}
        loading="lazy"
        decoding="async"
        style={{
          width: 140,
          height: 210,
          objectFit: "cover",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "#eee",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 140,
        height: 210,
        border: "1px solid #ddd",
        borderRadius: 10,
        background: "#eee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      No cover
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <a
      href={result.href}
      style={{
        border: "none",
        borderBottom: "1px solid #ddd",
        borderRadius: 0,
        padding: 16,
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        background: "#fff",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <ResultCover result={result} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            lineHeight: 1.15,
          }}
        >
          {result.title}
        </h2>

        <p
          style={{
            margin: "0 0 10px",
            color: "#555",
            lineHeight: 1.4,
            fontSize: 16,
          }}
        >
          {result.subtitle}
        </p>

        <p
          style={{
            margin: "0 0 14px",
            color: "#666",
            textTransform: "uppercase",
            fontSize: 13,
            letterSpacing: 0.3,
            fontWeight: 600,
          }}
        >
          {getTypeLabel(result.type)} · {result.source}
        </p>

        <span
          style={{
            display: "inline-block",
            padding: "8px 11px",
            borderRadius: 8,
            border: "1px solid #ff7f7a",
            fontWeight: 700,
            fontSize: 14,
            background: "#ffe2df",
            color: "#111",
          }}
        >
          {getActionLabel(result)}
        </span>
      </div>
    </a>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runSearch(nextQuery = query) {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setMessage("");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
        {
          cache: "no-store",
        }
      );

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setResults([]);
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

      if (!Array.isArray(data.results)) {
        setResults([]);
        setMessage(
          JSON.stringify(
            {
              error: "Search response did not include a results array.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setResults(data.results);
    } catch (error) {
      setResults([]);
      setMessage(
        JSON.stringify(
          {
            error: "Search request crashed.",
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

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query);
  }

  useEffect(() => {
    if (initialQuery) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <main
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        background: "#f7f8fa",
      }}
    >
      <section
        style={{
          padding: "40px 48px 28px",
          background: "#fff",
          borderBottom: "2px solid #ff7f7a",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 42,
          }}
        >
          Search
        </h1>

        <p
          style={{
            color: "#555",
            marginTop: 10,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Search movies, shows, books, albums, games, and people.
        </p>
      </section>

      <div
        style={{
          padding: "28px 48px 40px",
        }}
      >
        <section
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <form
            onSubmit={submitSearch}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                flex: 1,
                minWidth: 260,
                fontWeight: 600,
              }}
            >
              Search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies, shows, books, albums, games..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 13px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  font: "inherit",
                  marginTop: 6,
                  background: "#fff",
                }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px 16px",
                borderRadius: 8,
                border: "1px solid #ff7f7a",
                background: loading ? "#f0b7b3" : "#ff7f7a",
                color: "white",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </section>

        {message && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#fff",
              padding: 14,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 20,
            }}
          >
            {message}
          </pre>
        )}

        {!loading && query.trim() && results.length === 0 && !message && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <p style={{ color: "#777", margin: 0 }}>No results found.</p>
          </section>
        )}

        {results.length > 0 ? (
          <section>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Results</h2>

            <div
              style={{
                display: "grid",
                gap: 0,
                border: "1px solid #ddd",
                borderRadius: 14,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            width: "100%",
            minHeight: "100vh",
            margin: 0,
            boxSizing: "border-box",
            background: "#f7f8fa",
            padding: 40,
          }}
        >
          Loading search...
        </main>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
