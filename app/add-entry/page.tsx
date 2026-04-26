"use client";

import { useEffect, useMemo, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type SearchBy =
  | "title"
  | "person"
  | "author"
  | "isbn"
  | "artist"
  | "studio"
  | "developer";

type LocalMediaResult = {
  id: number;
  title: string;
  type: string;
  releaseDate: string | null;
  coverUrl?: string | null;
  movieDetails?: {
    runtimeMinutes: number | null;
  } | null;
  showDetails?: {
    seasonsCount: number | null;
    episodesCount: number | null;
    avgRuntimeMinutes: number | null;
    showStatus: string | null;
  } | null;
  bookDetails?: {
    pageCount: number | null;
    estimatedReadTimeMinutes: number | null;
    isbn13: string | null;
  } | null;
  albumDetails?: {
    totalTracks: number | null;
    durationSeconds: number | null;
    primaryArtistName: string | null;
  } | null;
  gameDetails?: {
    timeToBeatHours?: number | null;
    multiplayer?: boolean | null;
  } | null;
};

type ExternalMediaResult = {
  provider: "TMDB" | "GOOGLE_BOOKS" | "MUSICBRAINZ" | "RAWG";
  externalId: string;
  title: string;
  type: "MOVIE" | "SHOW" | "BOOK" | "ALBUM" | "GAME";
  releaseDate: string | null;
  coverUrl: string | null;
  description: string | null;
  authors?: string[];
  artists?: string[];
  platforms?: string[];
  genres?: string[];
  pageCount?: number | null;
  isbn13?: string | null;
  primaryType?: string | null;
  secondaryTypes?: string[];
  rating?: number | null;
  metacritic?: number | null;
  playtime?: number | null;
};

type MediaResult = LocalMediaResult | ExternalMediaResult;

function isExternalMedia(item: MediaResult): item is ExternalMediaResult {
  return "externalId" in item;
}

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

function getResultArray(data: any): MediaResult[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatYear(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 4);
  }

  return String(parsed.getFullYear());
}

function getExternalKey(item: ExternalMediaResult) {
  return `${item.provider}:${item.externalId}:${item.type}`;
}

function getResultKey(item: MediaResult) {
  return isExternalMedia(item) ? getExternalKey(item) : `LOCAL:${item.id}`;
}

function isSelectedResult(
  item: MediaResult,
  selectedMedia: LocalMediaResult | null,
  selectedExternalKey: string | null
) {
  if (!selectedMedia) return false;

  if (isExternalMedia(item)) {
    return selectedExternalKey === getExternalKey(item);
  }

  return selectedMedia.id === item.id;
}

function getSearchOptions(
  source: "local" | "tmdb" | "books" | "musicbrainz" | "rawg",
  tmdbType: "movie" | "tv"
): { value: SearchBy; label: string }[] {
  if (source === "tmdb") {
    return [
      { value: "title", label: tmdbType === "tv" ? "TV title" : "Movie title" },
      { value: "person", label: "Actor / director / creator" },
    ];
  }

  if (source === "books") {
    return [
      { value: "title", label: "Book title" },
      { value: "author", label: "Author" },
      { value: "isbn", label: "ISBN" },
    ];
  }

  if (source === "musicbrainz") {
    return [
      { value: "title", label: "Album title" },
      { value: "artist", label: "Artist" },
    ];
  }

  if (source === "rawg") {
    return [
      { value: "title", label: "Game title" },
      { value: "developer", label: "Developer / studio" },
    ];
  }

  return [
    { value: "title", label: "Title" },
    { value: "person", label: "Creator / artist / person" },
  ];
}

function getPlaceholder({
  source,
  tmdbType,
  searchBy,
}: {
  source: "local" | "tmdb" | "books" | "musicbrainz" | "rawg";
  tmdbType: "movie" | "tv";
  searchBy: SearchBy;
}) {
  if (source === "tmdb" && searchBy === "person") {
    return tmdbType === "tv"
      ? "Search actor/creator, e.g. Bryan Cranston..."
      : "Search actor/director, e.g. David Lynch...";
  }

  if (source === "tmdb") {
    return tmdbType === "tv" ? "Search TV shows..." : "Search movies...";
  }

  if (source === "books" && searchBy === "author") {
    return "Search author, e.g. Susanna Clarke...";
  }

  if (source === "books" && searchBy === "isbn") {
    return "Search ISBN...";
  }

  if (source === "books") {
    return "Search books...";
  }

  if (source === "musicbrainz" && searchBy === "artist") {
    return "Search artist, e.g. Aphex Twin...";
  }

  if (source === "musicbrainz") {
    return "Search albums, e.g. Selected Ambient Works...";
  }

  if (source === "rawg" && searchBy === "developer") {
    return "Search developer/studio, e.g. Nintendo...";
  }

  if (source === "rawg") {
    return "Search games...";
  }

  if (source === "local" && searchBy === "person") {
    return "Search creators/artists/people in local DB...";
  }

  return "Search local media...";
}

export default function AddEntryPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<LocalMediaResult | null>(
    null
  );
  const [selectedExternalKey, setSelectedExternalKey] = useState<string | null>(
    null
  );
  const [result, setResult] = useState("");
  const [source, setSource] = useState<
    "local" | "tmdb" | "books" | "musicbrainz" | "rawg"
  >("local");
  const [tmdbType, setTmdbType] = useState<"movie" | "tv">("movie");
  const [searchBy, setSearchBy] = useState<SearchBy>("title");
  const [loading, setLoading] = useState(false);

  const searchOptions = useMemo(
    () => getSearchOptions(source, tmdbType),
    [source, tmdbType]
  );

  useEffect(() => {
    const validOptions = getSearchOptions(source, tmdbType).map(
      (option) => option.value
    );

    if (!validOptions.includes(searchBy)) {
      setSearchBy("title");
    }
  }, [source, tmdbType, searchBy]);

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
      } catch (error) {
        setCurrentUser(null);
        setResult(
          JSON.stringify(
            {
              error: "Failed to load current user.",
              details: String(error),
            },
            null,
            2
          )
        );
      } finally {
        setAuthLoaded(true);
      }
    }

    loadCurrentUser();
  }, []);

  function setSourceAndReset(
    nextSource: "local" | "tmdb" | "books" | "musicbrainz" | "rawg"
  ) {
    setSource(nextSource);
    setSearchBy("title");
    setResults([]);
    setSelectedMedia(null);
    setSelectedExternalKey(null);
    setResult("");
  }

  async function searchMedia() {
    if (!currentUser) {
      setResult("Please log in before searching and adding entries.");
      return;
    }

    if (!query.trim()) {
      setResult("Please enter a search term.");
      return;
    }

    setLoading(true);
    setResult("");
    setSelectedMedia(null);
    setSelectedExternalKey(null);
    setResults([]);

    try {
      const params = new URLSearchParams({
        q: query,
        searchBy,
      });

      let endpoint = `/api/media/search?${params.toString()}`;

      if (source === "tmdb") {
        params.set("type", tmdbType);
        endpoint = `/api/media/external/tmdb/search?${params.toString()}`;
      }

      if (source === "books") {
        endpoint = `/api/media/external/books/search?${params.toString()}`;
      }

      if (source === "musicbrainz") {
        endpoint = `/api/media/external/musicbrainz/search?${params.toString()}`;
      }

      if (source === "rawg") {
        endpoint = `/api/media/external/rawg/search?${params.toString()}`;
      }

      const res = await fetch(endpoint);
      const data = await safeJson(res);

      if (!res.ok || !data) {
        setResult(
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

      const nextResults = getResultArray(data);
      setResults(nextResults);

      if (source === "musicbrainz" && nextResults.length > 0) {
        setResult(
          "Tip: MusicBrainz can include obscure duplicate releases. Use Artist search for cleaner album results, e.g. search artist “Aphex Twin”."
        );
      }
    } catch (error) {
      setResult(
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

  async function selectMedia(item: MediaResult) {
    setResult("");

    if (!currentUser) {
      setResult("Please log in before selecting media.");
      return;
    }

    if (!isExternalMedia(item)) {
      setSelectedMedia(item);
      setSelectedExternalKey(null);
      return;
    }

    const externalKey = getExternalKey(item);

    setLoading(true);
    setSelectedExternalKey(externalKey);

    try {
      const res = await fetch("/api/media/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: item.provider,
          externalId: item.externalId,
          type: item.type,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setResult(
          JSON.stringify(
            {
              status: res.status,
              error: "Import failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      if (!data.media) {
        setResult(
          JSON.stringify(
            {
              error: "Import response did not include media.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setSelectedMedia(data.media);
      setResult(
        data.imported
          ? `Imported "${data.media.title}" into local database.`
          : `"${data.media.title}" already existed in local database.`
      );
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            error: "Import request crashed.",
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMedia) {
      setResult("Please select a media item first.");
      return;
    }

    if (!currentUser) {
      setResult("Please log in before saving an entry.");
      return;
    }

    const form = new FormData(event.currentTarget);

    setLoading(true);

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          mediaId: selectedMedia.id,
          status: form.get("status"),
          ratingValue: Number(form.get("ratingValue")),
          reviewText: form.get("reviewText"),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setResult(
          JSON.stringify(
            {
              status: res.status,
              error: "Saving entry failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setResult(
        `Saved entry for "${selectedMedia.title}".\n\nView media page: /media/${selectedMedia.id}\nView profile: /profiles/${currentUser.username}`
      );
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            error: "Save entry request crashed.",
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

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1>Add / Update Entry</h1>

      {!authLoaded ? (
        <p style={{ color: "#555" }}>Checking login...</p>
      ) : currentUser ? (
        <p style={{ color: "#555" }}>
          Saving entries as{" "}
          <strong>
            {currentUser.displayName || currentUser.username} (@
            {currentUser.username})
          </strong>
        </p>
      ) : (
        <div
          style={{
            border: "1px solid #f0b4b4",
            background: "#fff5f5",
            padding: 14,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <p style={{ color: "#900", marginTop: 0 }}>
            You are not logged in. Log in or create an account before saving
            entries.
          </p>

          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              border: "1px solid #222",
              borderRadius: 8,
              textDecoration: "none",
              color: "black",
              fontWeight: 700,
              marginRight: 10,
              background: "white",
            }}
          >
            Log In
          </a>

          <a
            href="/signup"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 8,
              textDecoration: "none",
              color: "black",
              fontWeight: 700,
              background: "white",
            }}
          >
            Sign Up
          </a>
        </div>
      )}

      <section style={{ marginBottom: 30 }}>
        <h2>Search Media</h2>

        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              name="source"
              checked={source === "local"}
              onChange={() => setSourceAndReset("local")}
            />{" "}
            Local DB
          </label>

          <label style={{ marginLeft: 16 }}>
            <input
              type="radio"
              name="source"
              checked={source === "tmdb"}
              onChange={() => setSourceAndReset("tmdb")}
            />{" "}
            TMDB
          </label>

          <label style={{ marginLeft: 16 }}>
            <input
              type="radio"
              name="source"
              checked={source === "books"}
              onChange={() => setSourceAndReset("books")}
            />{" "}
            Google Books
          </label>

          <label style={{ marginLeft: 16 }}>
            <input
              type="radio"
              name="source"
              checked={source === "musicbrainz"}
              onChange={() => setSourceAndReset("musicbrainz")}
            />{" "}
            MusicBrainz Albums
          </label>

          <label style={{ marginLeft: 16 }}>
            <input
              type="radio"
              name="source"
              checked={source === "rawg"}
              onChange={() => setSourceAndReset("rawg")}
            />{" "}
            RAWG Games
          </label>
        </div>

        {source === "tmdb" && (
          <div style={{ marginBottom: 12 }}>
            <label>
              <input
                type="radio"
                name="tmdbType"
                checked={tmdbType === "movie"}
                onChange={() => {
                  setTmdbType("movie");
                  setResults([]);
                  setSelectedMedia(null);
                  setSelectedExternalKey(null);
                }}
              />{" "}
              Movies
            </label>

            <label style={{ marginLeft: 16 }}>
              <input
                type="radio"
                name="tmdbType"
                checked={tmdbType === "tv"}
                onChange={() => {
                  setTmdbType("tv");
                  setResults([]);
                  setSelectedMedia(null);
                  setSelectedExternalKey(null);
                }}
              />{" "}
              TV Shows
            </label>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>
            Search by{" "}
            <select
              value={searchBy}
              onChange={(event) => {
                setSearchBy(event.target.value as SearchBy);
                setResults([]);
                setSelectedMedia(null);
                setSelectedExternalKey(null);
              }}
              style={{ padding: 8, marginLeft: 6 }}
            >
              {searchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={getPlaceholder({ source, tmdbType, searchBy })}
          style={{ padding: 8, width: 430, maxWidth: "100%" }}
        />

        <button
          type="button"
          onClick={searchMedia}
          disabled={loading || !currentUser}
          style={{ marginLeft: 10, padding: 8 }}
        >
          {loading ? "Loading..." : "Search"}
        </button>

        {source === "musicbrainz" && (
          <p style={{ color: "#777", fontSize: 14, maxWidth: 720 }}>
              MusicBrainz can include obscure duplicate releases, so results are ranked
              by title match, album type, release count, and release date. Artist search
              is still the cleanest option for messy album titles.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          {results.map((item) => {
            const year = formatYear(item.releaseDate);
            const selected = isSelectedResult(
              item,
              selectedMedia,
              selectedExternalKey
            );

            return (
              <button
                key={getResultKey(item)}
                type="button"
                onClick={() => selectMedia(item)}
                disabled={loading || !currentUser}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  marginBottom: 8,
                  border: selected ? "2px solid black" : "1px solid #ccc",
                  borderRadius: 8,
                  background: selected ? "#f1f1f1" : "white",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                <strong>{item.title}</strong> ({item.type})
                {year && <span> — {year}</span>}

                {!isExternalMedia(item) &&
                  item.movieDetails?.runtimeMinutes && (
                    <span> — {item.movieDetails.runtimeMinutes} min</span>
                  )}

                {!isExternalMedia(item) &&
                  item.showDetails?.seasonsCount && (
                    <span> — {item.showDetails.seasonsCount} seasons</span>
                  )}

                {!isExternalMedia(item) && item.bookDetails?.pageCount && (
                  <span> — {item.bookDetails.pageCount} pages</span>
                )}

                {!isExternalMedia(item) &&
                  item.albumDetails?.primaryArtistName && (
                    <span> — {item.albumDetails.primaryArtistName}</span>
                  )}

                {!isExternalMedia(item) && item.albumDetails?.totalTracks && (
                  <span> — {item.albumDetails.totalTracks} tracks</span>
                )}

                {!isExternalMedia(item) &&
                  item.gameDetails?.timeToBeatHours && (
                    <span> — {item.gameDetails.timeToBeatHours} hrs</span>
                  )}

                {!isExternalMedia(item) &&
                  item.type === "GAME" &&
                  item.gameDetails?.multiplayer !== undefined && (
                    <span>
                      {" "}
                      —{" "}
                      {item.gameDetails.multiplayer
                        ? "Multiplayer"
                        : "Single-player"}
                    </span>
                  )}

                {isExternalMedia(item) && item.provider === "TMDB" && (
                  <span> — TMDB result</span>
                )}

                {isExternalMedia(item) &&
                  item.provider === "GOOGLE_BOOKS" && (
                    <span>
                      {" "}
                      — Google Books result
                      {item.authors?.length
                        ? ` — ${item.authors.join(", ")}`
                        : ""}
                      {item.pageCount ? ` — ${item.pageCount} pages` : ""}
                    </span>
                  )}

                {isExternalMedia(item) &&
                  item.provider === "MUSICBRAINZ" && (
                    <span>
                      {" "}
                      — MusicBrainz album
                      {item.artists?.length
                        ? ` — ${item.artists.join(", ")}`
                        : ""}
                    </span>
                  )}

                {isExternalMedia(item) && item.provider === "RAWG" && (
                  <span>
                    {" "}
                    — RAWG game
                    {item.platforms?.length
                      ? ` — ${item.platforms.slice(0, 3).join(", ")}`
                      : ""}
                    {item.genres?.length
                      ? ` — ${item.genres.slice(0, 3).join(", ")}`
                      : ""}
                    {item.metacritic ? ` — Metacritic ${item.metacritic}` : ""}
                    {item.playtime ? ` — ${item.playtime} hrs avg` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {selectedMedia && (
        <div
          style={{
            marginBottom: 20,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#f7f7f7",
            padding: 12,
          }}
        >
          <p style={{ marginTop: 0 }}>
            Selected local media: <strong>{selectedMedia.title}</strong> — ID{" "}
            {selectedMedia.id}
          </p>

          <a href={`/media/${selectedMedia.id}`}>View Media Page</a>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>Status</label>
        <br />
        <select name="status" defaultValue="COMPLETED">
          <option value="WISHLIST">Wishlist</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="PAUSED">Paused</option>
          <option value="DROPPED">Dropped</option>
        </select>

        <br />
        <br />

        <label>Rating 1-10</label>
        <br />
        <input
          name="ratingValue"
          type="number"
          min="1"
          max="10"
          defaultValue="9"
        />

        <br />
        <br />

        <label>Review</label>
        <br />
        <textarea
          name="reviewText"
          defaultValue="Updated from search/import UI."
          style={{ width: 400, height: 100, maxWidth: "100%" }}
        />

        <br />
        <br />

        <button
          type="submit"
          disabled={!selectedMedia || loading || !currentUser}
        >
          Save Entry
        </button>
      </form>

      <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>{result}</pre>

      {selectedMedia && (
        <div style={{ marginTop: 20 }}>
          <a href={`/media/${selectedMedia.id}`}>Go to Media Page</a>
          {" | "}
          {currentUser ? (
            <a href={`/profiles/${currentUser.username}`}>Go to My Profile</a>
          ) : (
            <a href="/login">Log In</a>
          )}
        </div>
      )}
    </main>
  );
}