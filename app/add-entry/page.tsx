"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const AUTH_CACHE_KEY = "media_app_current_user_cache";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type Source = "local" | "tmdb" | "books" | "spotify" | "rawg";
type TmdbType = "movie" | "tv";
type MediaTypeFilter = "ALL" | "MOVIE" | "SHOW" | "BOOK" | "ALBUM" | "GAME";
type SearchBy =
  | "title"
  | "person"
  | "author"
  | "isbn"
  | "artist"
  | "developer";
type SortBy = "relevance" | "popularity" | "newest" | "oldest" | "rating";

type LocalMediaResult = {
  id: number;
  title: string;
  type: string;
  releaseDate: string | null;
  coverUrl?: string | null;
  description?: string | null;
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
  provider: "TMDB" | "GOOGLE_BOOKS" | "SPOTIFY" | "RAWG";
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
  rating?: number | null;
  metacritic?: number | null;
  playtime?: number | null;
  voteAverage?: number | null;
  voteCount?: number | null;
  popularity?: number | null;
  spotifyPopularity?: number | null;
  spotifyArtistFollowers?: number | null;
};

type MediaResult = LocalMediaResult | ExternalMediaResult;

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

function clearCachedUser() {
  try {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    window.dispatchEvent(new Event("media-app-auth-changed"));
  } catch {
    // Ignore storage failures.
  }
}

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

function getNumericYear(value: string | null) {
  const year = formatYear(value);
  if (!year) return null;

  const numeric = Number(year);
  return Number.isInteger(numeric) ? numeric : null;
}

function getExternalKey(item: ExternalMediaResult) {
  return `${item.provider}:${item.externalId}:${item.type}`;
}

function getResultKey(item: MediaResult) {
  return isExternalMedia(item) ? getExternalKey(item) : `LOCAL:${item.id}`;
}

function getSearchOptions(source: Source, tmdbType: TmdbType) {
  if (source === "tmdb") {
    return [
      { value: "title", label: tmdbType === "tv" ? "TV title" : "Movie title" },
      { value: "person", label: "Actor / director / creator" },
    ] satisfies { value: SearchBy; label: string }[];
  }

  if (source === "books") {
    return [
      { value: "title", label: "Book title" },
      { value: "author", label: "Author" },
      { value: "isbn", label: "ISBN" },
    ] satisfies { value: SearchBy; label: string }[];
  }

  if (source === "spotify") {
    return [
      { value: "title", label: "Album title" },
      { value: "artist", label: "Artist" },
    ] satisfies { value: SearchBy; label: string }[];
  }

  if (source === "rawg") {
    return [
      { value: "title", label: "Game title" },
      { value: "developer", label: "Developer / studio" },
    ] satisfies { value: SearchBy; label: string }[];
  }

  return [
    { value: "title", label: "Title" },
    { value: "person", label: "Creator / artist / person" },
  ] satisfies { value: SearchBy; label: string }[];
}

function getPlaceholder({
  source,
  tmdbType,
  searchBy,
}: {
  source: Source;
  tmdbType: TmdbType;
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

  if (source === "spotify" && searchBy === "artist") {
    return "Search artist, e.g. Autechre...";
  }

  if (source === "spotify") {
    return "Search albums...";
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

  return "Search media...";
}

function getProviderLabel(item: MediaResult) {
  if (!isExternalMedia(item)) return "Local DB";

  if (item.provider === "TMDB") return "TMDB";
  if (item.provider === "GOOGLE_BOOKS") return "Google Books";
  if (item.provider === "SPOTIFY") return "Spotify";
  if (item.provider === "RAWG") return "RAWG";

  return item.provider;
}

function getResultDescription(item: MediaResult) {
  if (isExternalMedia(item)) return item.description;
  return item.description ?? null;
}

function getResultPeople(item: MediaResult) {
  if (!isExternalMedia(item)) {
    if (item.albumDetails?.primaryArtistName) return item.albumDetails.primaryArtistName;
    return null;
  }

  if (item.authors?.length) return item.authors.join(", ");
  if (item.artists?.length) return item.artists.join(", ");
  if (item.platforms?.length) return item.platforms.slice(0, 3).join(", ");

  return null;
}

function getResultScore(item: MediaResult) {
  if (!isExternalMedia(item)) return null;

  return (
    item.popularity ??
    item.spotifyPopularity ??
    item.voteCount ??
    item.voteAverage ??
    item.metacritic ??
    item.rating ??
    null
  );
}

function ResultCover({ item }: { item: MediaResult }) {
  const coverUrl = item.coverUrl ?? null;

  if (item.type === "ALBUM") {
    const artist =
      isExternalMedia(item) && item.artists?.length
        ? item.artists.join(", ")
        : !isExternalMedia(item)
          ? item.albumDetails?.primaryArtistName
          : null;

    return (
      <div
        style={{
          width: 140,
          height: 210,
          border: "1px solid var(--app-border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--app-surface-strong)",
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
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.1,
          }}
        >
          {artist || "Unknown Artist"}
        </div>

        <div
          style={{
            width: 140,
            height: 140,
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={item.title}
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
            "No cover"
          )}
        </div>

        <div
          style={{
            height: 35,
            padding: "5px 7px",
            fontSize: 12,
            fontWeight: 800,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.1,
          }}
        >
          {item.title}
        </div>
      </div>
    );
  }

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={item.title}
        loading="lazy"
        decoding="async"
        style={{
          width: 140,
          height: 210,
          objectFit: "cover",
          borderRadius: 10,
          border: "1px solid var(--app-border)",
          background: "#eee",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 140,
        height: 210,
        border: "1px solid var(--app-border)",
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

function ResultMeta({ item }: { item: MediaResult }) {
  const year = formatYear(item.releaseDate);
  const parts: string[] = [];

  parts.push(item.type);
  parts.push(getProviderLabel(item));

  if (year) parts.push(year);

  const people = getResultPeople(item);
  if (people) parts.push(people);

  if (isExternalMedia(item)) {
    if (item.pageCount) parts.push(`${item.pageCount} pages`);
    if (item.metacritic) parts.push(`Metacritic ${item.metacritic}`);
    if (item.playtime) parts.push(`${item.playtime} hrs avg`);
    if (item.voteAverage) parts.push(`TMDB ${item.voteAverage}`);
    if (item.spotifyPopularity) parts.push(`Spotify popularity ${item.spotifyPopularity}`);
  } else {
    if (item.movieDetails?.runtimeMinutes) {
      parts.push(`${item.movieDetails.runtimeMinutes} min`);
    }

    if (item.showDetails?.seasonsCount) {
      parts.push(`${item.showDetails.seasonsCount} seasons`);
    }

    if (item.bookDetails?.pageCount) {
      parts.push(`${item.bookDetails.pageCount} pages`);
    }

    if (item.albumDetails?.totalTracks) {
      parts.push(`${item.albumDetails.totalTracks} tracks`);
    }

    if (item.gameDetails?.timeToBeatHours) {
      parts.push(`${item.gameDetails.timeToBeatHours} hrs`);
    }
  }

  return (
    <p style={{ margin: "6px 0 0", color: "#555", lineHeight: 1.35 }}>
      {parts.join(" · ")}
    </p>
  );
}

function selectedMatches(
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

export default function AddEntryPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<LocalMediaResult | null>(null);
  const [selectedExternalKey, setSelectedExternalKey] = useState<string | null>(null);

  const [result, setResult] = useState("");
  const [source, setSource] = useState<Source>("tmdb");
  const [mediaType, setMediaType] = useState<MediaTypeFilter>("MOVIE");
  const [tmdbType, setTmdbType] = useState<TmdbType>("movie");
  const [searchBy, setSearchBy] = useState<SearchBy>("title");
  const [sortBy, setSortBy] = useState<SortBy>("relevance");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minRating, setMinRating] = useState("");
  const [loading, setLoading] = useState(false);

  const searchOptions = useMemo(
    () => getSearchOptions(source, tmdbType),
    [source, tmdbType]
  );

  useEffect(() => {
    setCurrentUser(readCachedUser());
    setAuthLoaded(true);

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

  useEffect(() => {
    const validOptions = getSearchOptions(source, tmdbType).map(
      (option) => option.value
    );

    if (!validOptions.includes(searchBy)) {
      setSearchBy("title");
    }
  }, [source, tmdbType, searchBy]);

  function resetResults() {
    setResults([]);
    setSelectedMedia(null);
    setSelectedExternalKey(null);
    setResult("");
  }

  function setSourceAndReset(nextSource: Source) {
    setSource(nextSource);
    setSearchBy("title");
    resetResults();

    if (nextSource === "tmdb") {
      setMediaType(tmdbType === "tv" ? "SHOW" : "MOVIE");
    }

    if (nextSource === "books") {
      setMediaType("BOOK");
    }

    if (nextSource === "spotify") {
      setMediaType("ALBUM");
    }

    if (nextSource === "rawg") {
      setMediaType("GAME");
    }

    if (nextSource === "local") {
      setMediaType("ALL");
    }
  }

  function setMediaTypeAndSource(nextType: MediaTypeFilter) {
    setMediaType(nextType);
    resetResults();

    if (nextType === "MOVIE") {
      setSource("tmdb");
      setTmdbType("movie");
    }

    if (nextType === "SHOW") {
      setSource("tmdb");
      setTmdbType("tv");
    }

    if (nextType === "BOOK") {
      setSource("books");
    }

    if (nextType === "ALBUM") {
      setSource("spotify");
    }

    if (nextType === "GAME") {
      setSource("rawg");
    }

    if (nextType === "ALL") {
      setSource("local");
    }
  }

  function setTmdbTypeAndReset(nextType: TmdbType) {
    setTmdbType(nextType);
    setMediaType(nextType === "tv" ? "SHOW" : "MOVIE");
    resetResults();
  }

  function addAdvancedParams(params: URLSearchParams) {
    params.set("sort", sortBy);

    if (yearFrom.trim()) {
      params.set("yearFrom", yearFrom.trim());
    }

    if (yearTo.trim()) {
      params.set("yearTo", yearTo.trim());
    }

    if (minRating.trim()) {
      params.set("minRating", minRating.trim());
    }

    if (mediaType !== "ALL") {
      params.set("mediaType", mediaType);
    }
  }

  function applyClientFilters(items: MediaResult[]) {
    const from = yearFrom.trim() ? Number(yearFrom.trim()) : null;
    const to = yearTo.trim() ? Number(yearTo.trim()) : null;
    const min = minRating.trim() ? Number(minRating.trim()) : null;

    let filtered = items.filter((item) => {
      const year = getNumericYear(item.releaseDate);

      if (mediaType !== "ALL" && item.type !== mediaType) {
        return false;
      }

      if (from && year && year < from) {
        return false;
      }

      if (to && year && year > to) {
        return false;
      }

      if (min && isExternalMedia(item)) {
        const score =
          item.voteAverage ??
          item.rating ??
          item.metacritic ??
          item.spotifyPopularity ??
          null;

        if (score !== null && score < min) {
          return false;
        }
      }

      return true;
    });

    if (sortBy === "newest") {
      filtered = filtered.sort(
        (a, b) => (getNumericYear(b.releaseDate) ?? 0) - (getNumericYear(a.releaseDate) ?? 0)
      );
    }

    if (sortBy === "oldest") {
      filtered = filtered.sort(
        (a, b) => (getNumericYear(a.releaseDate) ?? 9999) - (getNumericYear(b.releaseDate) ?? 9999)
      );
    }

    if (sortBy === "popularity" || sortBy === "rating") {
      filtered = filtered.sort((a, b) => {
        const aScore = getResultScore(a) ?? 0;
        const bScore = getResultScore(b) ?? 0;
        return bScore - aScore;
      });
    }

    return filtered;
  }

  async function searchMedia() {
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
        q: query.trim(),
        searchBy,
      });

      addAdvancedParams(params);

      let endpoint = `/api/media/search?${params.toString()}`;

      if (source === "tmdb") {
        params.set("type", tmdbType);
        endpoint = `/api/media/external/tmdb/search?${params.toString()}`;
      }

      if (source === "books") {
        endpoint = `/api/media/external/books/search?${params.toString()}`;
      }

      if (source === "spotify") {
        endpoint = `/api/media/external/spotify/search?${params.toString()}`;
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

      const nextResults = applyClientFilters(getResultArray(data));

      setResults(nextResults);

      if (nextResults.length === 0) {
        setResult("No results found.");
        return;
      }

      if (source === "spotify") {
        setResult(
          "Spotify album results include album art, artist names, release dates, and popularity where available."
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

      const importedMedia =
        data.media || data.mediaItem || data.item || data.result || null;

      if (!importedMedia) {
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

      setSelectedMedia(importedMedia);
      setResult(
        data.imported
          ? `Imported "${importedMedia.title}" into local database.`
          : `"${importedMedia.title}" already existed in local database.`
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
    const ratingRaw = form.get("ratingValue");
    const ratingValue =
      ratingRaw === null || ratingRaw === "" ? null : Number(ratingRaw);

    setLoading(true);

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          status: form.get("status"),
          ratingValue,
          reviewText: form.get("reviewText"),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        if (res.status === 401) {
          setCurrentUser(null);
          clearCachedUser();
        }

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
    <main style={{ padding: "36px clamp(20px, 4vw, 64px)", width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
      <h1>Add Entry / Advanced Search</h1>

      <p style={{ color: "#555", maxWidth: 760 }}>
        Search across movies, TV, books, albums, and games. You can browse and
        import media without logging in. Log in only when you want to save a
        rating, review, or entry.
      </p>

      {authLoaded && currentUser ? (
        <p style={{ color: "#555" }}>
          Saving entries as{" "}
          <strong>
            {currentUser.displayName || currentUser.username} (@
            {currentUser.username})
          </strong>
        </p>
      ) : null}

      <section
        style={{
          marginBottom: 30,
          border: "1px solid var(--app-border)",
          borderRadius: 14,
          padding: 18,
          background: "var(--app-surface-strong)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Detailed Search</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <label>
            Media type
            <select
              value={mediaType}
              onChange={(event) =>
                setMediaTypeAndSource(event.target.value as MediaTypeFilter)
              }
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            >
              <option value="ALL">All local media</option>
              <option value="MOVIE">Movies</option>
              <option value="SHOW">TV Shows</option>
              <option value="BOOK">Books</option>
              <option value="ALBUM">Albums</option>
              <option value="GAME">Games</option>
            </select>
          </label>

          <label>
            Source
            <select
              value={source}
              onChange={(event) => setSourceAndReset(event.target.value as Source)}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            >
              <option value="local">Local DB</option>
              <option value="tmdb">TMDB</option>
              <option value="books">Google Books</option>
              <option value="spotify">Spotify Albums</option>
              <option value="rawg">RAWG Games</option>
            </select>
          </label>

          {source === "tmdb" ? (
            <label>
              TMDB type
              <select
                value={tmdbType}
                onChange={(event) =>
                  setTmdbTypeAndReset(event.target.value as TmdbType)
                }
                style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              >
                <option value="movie">Movies</option>
                <option value="tv">TV Shows</option>
              </select>
            </label>
          ) : null}

          <label>
            Search by
            <select
              value={searchBy}
              onChange={(event) => {
                setSearchBy(event.target.value as SearchBy);
                resetResults();
              }}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            >
              {searchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortBy);
                setResults((items) => applyClientFilters([...items]));
              }}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            >
              <option value="relevance">Relevance</option>
              <option value="popularity">Popularity</option>
              <option value="rating">Rating</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>

          <label>
            Year from
            <input
              value={yearFrom}
              onChange={(event) => setYearFrom(event.target.value)}
              placeholder="e.g. 1990"
              inputMode="numeric"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            />
          </label>

          <label>
            Year to
            <input
              value={yearTo}
              onChange={(event) => setYearTo(event.target.value)}
              placeholder="e.g. 2026"
              inputMode="numeric"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            />
          </label>

          <label>
            Min score
            <input
              value={minRating}
              onChange={(event) => setMinRating(event.target.value)}
              placeholder="rating/popularity"
              inputMode="numeric"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            />
          </label>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            searchMedia();
          }}
          style={{ display: "flex", gap: 10, alignItems: "center" }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={getPlaceholder({ source, tmdbType, searchBy })}
            style={{
              padding: 10,
              width: 520,
              maxWidth: "100%",
              border: "1px solid var(--app-border)",
              borderRadius: 999,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #222",
              background: "black",
              color: "white",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </form>
      </section>

      {results.length > 0 ? (
        <section style={{ marginBottom: 30 }}>
          <h2>Results</h2>

          <div style={{ display: "grid", gap: 14 }}>
            {results.map((item) => {
              const selected = selectedMatches(
                item,
                selectedMedia,
                selectedExternalKey
              );
              const description = getResultDescription(item);

              return (
                <button
                  key={getResultKey(item)}
                  type="button"
                  onClick={() => selectMedia(item)}
                  disabled={loading}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: selected ? "2px solid black" : "1px solid #ddd",
                    borderRadius: 14,
                    padding: 14,
                    background: selected ? "#f1f1f1" : "white",
                    display: "flex",
                    gap: 16,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <ResultCover item={item} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 18 }}>{item.title}</strong>

                    <ResultMeta item={item} />

                    {description ? (
                      <p
                        style={{
                          margin: "10px 0 0",
                          color: "#333",
                          lineHeight: 1.4,
                          maxHeight: 82,
                          overflow: "hidden",
                        }}
                      >
                        {description}
                      </p>
                    ) : null}

                    {isExternalMedia(item) ? (
                      <p style={{ margin: "10px 0 0", color: "#777", fontSize: 13 }}>
                        Click to import/open from {getProviderLabel(item)}.
                      </p>
                    ) : (
                      <p style={{ margin: "10px 0 0", color: "#777", fontSize: 13 }}>
                        Local media item.
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedMedia ? (
        <section
          style={{
            marginBottom: 24,
            border: "1px solid var(--app-border)",
            borderRadius: 14,
            background: "#f7f7f7",
            padding: 14,
          }}
        >
          <p style={{ marginTop: 0 }}>
            Selected media: <strong>{selectedMedia.title}</strong>
          </p>

          <Link href={`/media/${selectedMedia.id}`}>View Media Page</Link>
        </section>
      ) : null}

      <section
        style={{
          border: "1px solid var(--app-border)",
          borderRadius: 14,
          padding: 18,
          background: "var(--app-surface-strong)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Log / Review</h2>

        {!currentUser ? (
          <p style={{ color: "#777" }}>
            You can search and import without logging in.{" "}
            <Link href="/login">Log in</Link> to save an entry.
          </p>
        ) : null}

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
          <input name="ratingValue" type="number" min="1" max="10" />

          <br />
          <br />

          <label>Review</label>
          <br />
          <textarea
            name="reviewText"
            placeholder="Write your thoughts..."
            style={{ width: 500, height: 100, maxWidth: "100%" }}
          />

          <br />
          <br />

          <button
            type="submit"
            disabled={!selectedMedia || loading || !currentUser}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #222",
              background: !selectedMedia || !currentUser ? "#ccc" : "black",
              color: !selectedMedia || !currentUser ? "#555" : "white",
              fontWeight: 800,
              cursor: !selectedMedia || !currentUser ? "not-allowed" : "pointer",
            }}
          >
            Save Entry
          </button>
        </form>
      </section>

      {result ? (
        <pre
          style={{
            marginTop: 20,
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {result}
        </pre>
      ) : null}

      {selectedMedia ? (
        <div style={{ marginTop: 20 }}>
          <Link href={`/media/${selectedMedia.id}`}>Go to Media Page</Link>
          {" | "}
          {currentUser ? (
            <Link href={`/profiles/${currentUser.username}`}>Go to My Profile</Link>
          ) : (
            <Link href="/login">Log In</Link>
          )}
        </div>
      ) : null}
    </main>
  );
}