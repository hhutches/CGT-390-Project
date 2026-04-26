"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

function friendlyType(type: string) {
  if (type === "MOVIE") return "Movie";
  if (type === "SHOW") return "TV";
  if (type === "BOOK") return "Book";
  if (type === "ALBUM") return "Music";
  if (type === "GAME") return "Game";
  if (type === "PERSON") return "Person";
  return type;
}

function friendlySource(source: string) {
  if (source.includes("Spotify")) return "Music";
  if (source.includes("TMDB")) return "Movies / TV";
  if (source.includes("Google Books")) return "Books";
  if (source.includes("RAWG")) return "Games";
  if (source.includes("Local")) return "Library";
  return source
    .replace(" search", "")
    .replace("artist", "")
    .replace("title", "")
    .trim();
}

function getActionLabel(type: string) {
  if (type === "MOVIE" || type === "SHOW") return "Add / Review";
  if (type === "BOOK") return "Add / Review";
  if (type === "ALBUM") return "Add / Review";
  if (type === "GAME") return "Add / Review";
  return "Open";
}

function getImportHref(result: SearchResult) {
  if (result.provider && result.externalId) {
    return `/media/import?provider=${encodeURIComponent(
      result.provider
    )}&externalId=${encodeURIComponent(result.externalId)}&type=${encodeURIComponent(
      result.type
    )}`;
  }

  return result.href || "#";
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};

    for (const result of results) {
      const key = friendlyType(result.type);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(result);
    }

    return groups;
  }, [results]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!query) {
        setResults([]);
        setSelectedResult(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Search failed.");
        }

        if (!cancelled) {
          setResults(Array.isArray(data?.results) ? data.results : []);
          setSelectedResult(null);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSelectedResult(null);
          setError(err instanceof Error ? err.message : "Search failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header>
          <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
            Search
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {query ? query : "Search media"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Search across movies, TV, books, music, games, and your local library.
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-300">
            Searching…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-6 text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && query && results.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-300">
            No results found.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="flex flex-col gap-8">
            {Object.entries(groupedResults).map(([groupName, groupItems]) => (
              <div key={groupName}>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.22em] text-neutral-500">
                  {groupName}
                </h2>

                <div className="grid gap-3">
                  {groupItems.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedResult(result)}
                      className={`flex w-full gap-4 rounded-2xl border p-3 text-left transition ${
                        selectedResult?.id === result.id
                          ? "border-white bg-neutral-800"
                          : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-850"
                      }`}
                    >
                      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                        {result.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={result.coverUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                            {friendlyType(result.type)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold">
                            {result.title}
                          </h3>
                          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                            {friendlyType(result.type)}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-sm text-neutral-400">
                          {result.subtitle}
                        </p>

                        <p className="mt-2 text-xs text-neutral-500">
                          {friendlySource(result.source)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              {selectedResult ? (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <div className="h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                      {selectedResult.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedResult.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                          {friendlyType(selectedResult.type)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {friendlyType(selectedResult.type)}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {selectedResult.title}
                      </h2>
                      <p className="mt-2 text-sm text-neutral-400">
                        {selectedResult.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <a
                      href={getImportHref(selectedResult)}
                      className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-neutral-200"
                    >
                      {getActionLabel(selectedResult.type)}
                    </a>

                    <a
                      href={selectedResult.href}
                      className="rounded-xl border border-neutral-700 px-4 py-3 text-center text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
                    >
                      Open result
                    </a>
                  </div>

                  <p className="text-xs text-neutral-500">
                    Source: {friendlySource(selectedResult.source)}
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold">Select a result</h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    Click a result to add it, review it, rate it, or open its
                    details without losing the search results.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-950 p-8 text-white">
          Loading search…
        </main>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}