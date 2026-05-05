"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type FeedScope = "all" | "friends" | "me" | "popular";

type Media = {
  id: number;
  type: string;
  title: string;
  releaseDate: string | null;
  coverUrl: string | null;
  movieDetails?: {
    runtimeMinutes: number | null;
  } | null;
  showDetails?: {
    seasonsCount: number | null;
    episodesCount: number | null;
    showStatus: string | null;
  } | null;
  bookDetails?: {
    pageCount: number | null;
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
  provider?: string | null;
  externalId?: string | null;
  tmdbRank?: number | null;
  tmdbVoteAverage?: number | null;
  tmdbVoteCount?: number | null;
  tmdbPopularity?: number | null;
};

type FeedEvent = {
  id: number;
  eventType: string;
  bodyText: string | null;
  ratingValue: number | null;
  createdAt: string;
  entry: {
    id: number;
    status: string;
    reviewText: string | null;
    user: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
    media: Media;
  };
};

const AUTH_CACHE_KEY = "media_app_current_user_cache";

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
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    window.dispatchEvent(new Event("media-app-auth-changed"));
  } catch {
    // Ignore storage failures.
  }
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

function formatEventType(eventType: string) {
  const labels: Record<string, string> = {
    ADDED: "added",
    STARTED: "started",
    COMPLETED: "completed",
    RATED: "rated",
    REVIEWED: "reviewed",
    REWATCHED: "rewatched",
    UPDATED: "updated",
  };

  return labels[eventType] ?? eventType.toLowerCase();
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatYear(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 4);
  }

  return String(date.getFullYear());
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;

  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

const popularLoadingMessages = [
  "Loading a universe of media...",
  "Find your new all-time favorite...",
  "Entertainment incoming...",
];

function PopularLoadingMessage({ loading }: { loading: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;

    const interval = window.setInterval(() => {
      setMessageIndex(
        (current) => (current + 1) % popularLoadingMessages.length
      );
    }, 1500);

    return () => window.clearInterval(interval);
  }, [loading]);

  if (!loading) return null;

  return (
    <p
      style={{
        color: "#666",
        fontWeight: 700,
        marginTop: 10,
        marginBottom: 20,
        background: "#fff2f1",
        border: "1px solid #f3d0ce",
        borderRadius: 8,
        padding: "10px 14px",
        display: "inline-block",
      }}
    >
      {popularLoadingMessages[messageIndex]}
    </p>
  );
}

function getEmptyMessage(scope: FeedScope) {
  if (scope === "popular") {
    return "No popular movies, shows, albums, books, or games loaded yet.";
  }

  if (scope === "friends") {
    return "No friend activity yet. Once your friends log media, it will show here.";
  }

  if (scope === "me") {
    return "You have not logged anything yet.";
  }

  return "No feed activity yet.";
}

function getMediaHref(media: Media, scope: FeedScope) {
  if (scope === "popular" && media.provider === "TMDB" && media.externalId) {
    const type = media.type === "SHOW" ? "SHOW" : "MOVIE";

    return `/media/import?provider=TMDB&externalId=${encodeURIComponent(
      media.externalId
    )}&type=${type}`;
  }

  if (scope === "popular" && media.provider === "SPOTIFY" && media.externalId) {
    return `/media/import?provider=SPOTIFY&externalId=${encodeURIComponent(
      media.externalId
    )}&type=ALBUM`;
  }

  if (
    scope === "popular" &&
    media.provider === "GOOGLE_BOOKS" &&
    media.externalId
  ) {
    return `/media/import?provider=GOOGLE_BOOKS&externalId=${encodeURIComponent(
      media.externalId
    )}&type=BOOK`;
  }

  if (scope === "popular" && media.provider === "RAWG" && media.externalId) {
    return `/media/import?provider=RAWG&externalId=${encodeURIComponent(
      media.externalId
    )}&type=GAME`;
  }

  return `/media/${media.id}`;
}

function MediaCoverCard({ media }: { media: Media }) {
  if (media.type === "ALBUM") {
    return (
      <div
        style={{
          width: 160,
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
            padding: "8px",

            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            background: "#fafafa",
            borderBottom: "1px solid #eee",





          }}
        >
          {media.albumDetails?.primaryArtistName ?? "Unknown Artist"}
        </div>

        <div
          style={{
            width: 160,
            height: 160,
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {media.coverUrl ? (
            <img
              src={media.coverUrl}
              alt={media.title}
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
            padding: "8px",

            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,




          }}
        >
          {media.title}
        </div>
      </div>
    );
  }

  if (media.coverUrl) {
    return (
      <img
        src={media.coverUrl}
        alt={media.title}
        loading="lazy"
        decoding="async"
        style={{
          width: 160,
          height: 240,
          objectFit: "cover",
          borderRadius: 10,
          flexShrink: 0,
          border: "1px solid #ddd",
          background: "#eee",

        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 160,
        height: 240,
        border: "1px solid #ddd",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "#eee",
        fontSize: 12,
        color: "#666",


      }}
    >
      No cover
    </div>
  );
}

function MediaMeta({ media }: { media: Media }) {
  const year = formatYear(media.releaseDate);

  return (
    <div
      style={{
        color: "#555",
        fontSize: 14,
        marginTop: 6,




      }}
    >
      <span>{media.type}</span>















      {year && <span> · {year}</span>}

      {media.type === "MOVIE" && media.movieDetails?.runtimeMinutes && (
        <span> · {media.movieDetails.runtimeMinutes} min</span>
      )}

      {media.type === "SHOW" && media.showDetails?.seasonsCount && (
        <span> · {media.showDetails.seasonsCount} seasons</span>
      )}

      {media.type === "BOOK" && media.bookDetails?.pageCount && (
        <span> · {media.bookDetails.pageCount} pages</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.primaryArtistName && (
        <span> · {media.albumDetails.primaryArtistName}</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.totalTracks && (
        <span> · {media.albumDetails.totalTracks} tracks</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.durationSeconds && (
        <span> · {formatDuration(media.albumDetails.durationSeconds)}</span>
      )}

      {media.type === "GAME" && media.gameDetails?.timeToBeatHours && (
        <span> · {media.gameDetails.timeToBeatHours} hrs</span>
      )}

      {media.type === "GAME" && media.gameDetails?.multiplayer !== undefined && (
        <span>
          {" "}
          · {media.gameDetails.multiplayer ? "Multiplayer" : "Single-player"}
        </span>
      )}
    </div>
  );
}

function PopularMovieScroller({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 20,



      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Popular This Week</h2>











      <div
        style={{
          display: "flex",
          gap: 18,
          overflowX: "auto",
          width: "100%",
          paddingBottom: 10,

          scrollSnapType: "x mandatory",
        }}
      >
        {events.map((event) => {
          const media = event.entry.media;
          const mediaHref = getMediaHref(media, "popular");

          return (
            <a
              key={`${event.id}-${media.externalId || media.id}`}
              href={mediaHref}
              style={{
                width: 190,
                flex: "0 0 auto",
                color: "inherit",
                textDecoration: "none",
                scrollSnapAlign: "start",




              }}
            >
              {media.coverUrl ? (
                <img
                  src={media.coverUrl}
                  alt={media.title}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 190,
                    height: 285,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#eee",
                    display: "block",

                  }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 285,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#666",


                  }}
                >
                  No cover
                </div>
              )}

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 1.2,

                }}
              >
                {media.title}
              </strong>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PopularTvScroller({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 24,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 20,

      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Popular TV This Week</h2>











      <div
        style={{
          display: "flex",
          gap: 18,
          overflowX: "auto",
          width: "100%",
          paddingBottom: 10,

          scrollSnapType: "x mandatory",
        }}
      >
        {events.map((event) => {
          const media = event.entry.media;
          const mediaHref = getMediaHref(media, "popular");

          return (
            <a
              key={`${event.id}-${media.externalId || media.id}`}
              href={mediaHref}
              style={{
                width: 190,
                flex: "0 0 auto",
                color: "inherit",
                textDecoration: "none",
                scrollSnapAlign: "start",




              }}
            >
              {media.coverUrl ? (
                <img
                  src={media.coverUrl}
                  alt={media.title}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 190,
                    height: 285,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#eee",
                    display: "block",

                  }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 285,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#666",


                  }}
                >
                  No cover
                </div>
              )}

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 1.2,

                }}
              >
                {media.title}
              </strong>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PopularAlbumScroller({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 24,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 20,

      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Popular New Albums</h2>











      <div
        style={{
          display: "flex",
          gap: 18,
          overflowX: "auto",
          width: "100%",
          paddingBottom: 10,

          scrollSnapType: "x mandatory",
        }}
      >
        {events.map((event) => {
          const media = event.entry.media;
          const mediaHref = getMediaHref(media, "popular");

          return (
            <a
              key={`${event.id}-${media.externalId || media.id}`}
              href={mediaHref}
              style={{
                width: 190,
                flex: "0 0 auto",
                color: "inherit",
                textDecoration: "none",
                scrollSnapAlign: "start",




              }}
            >
              {media.coverUrl ? (
                <img
                  src={media.coverUrl}
                  alt={media.title}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 190,
                    height: 190,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#eee",
                    display: "block",

                  }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 190,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#666",


                  }}
                >
                  No cover
                </div>
              )}

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 1.2,

                }}
              >
                {media.title}
              </strong>

              {media.albumDetails?.primaryArtistName ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 13,
                    color: "#666",
                    lineHeight: 1.2,

                  }}
                >
                  {media.albumDetails.primaryArtistName}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PopularBookScroller({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 24,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 20,

      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Popular Books</h2>











      <div
        style={{
          display: "flex",
          gap: 18,
          overflowX: "auto",
          width: "100%",
          paddingBottom: 10,

          scrollSnapType: "x mandatory",
        }}
      >
        {events.map((event) => {
          const media = event.entry.media;
          const mediaHref = getMediaHref(media, "popular");

          return (
            <a
              key={`${event.id}-${media.externalId || media.id}`}
              href={mediaHref}
              style={{
                width: 190,
                flex: "0 0 auto",
                color: "inherit",
                textDecoration: "none",
                scrollSnapAlign: "start",




              }}
            >
              {media.coverUrl ? (
                <img
                  src={media.coverUrl}
                  alt={media.title}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 190,
                    height: 285,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#eee",
                    display: "block",


                  }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 285,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#666",



                  }}
                >
                  No cover
                </div>
              )}

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 1.2,

                }}
              >
                {media.title}
              </strong>

              {media.bookDetails?.pageCount ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 13,
                    color: "#666",
                    lineHeight: 1.2,

                  }}
                >
                  {media.bookDetails.pageCount} pages
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PopularGameScroller({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 24,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 20,

      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Popular Games</h2>











      <div
        style={{
          display: "flex",
          gap: 18,
          overflowX: "auto",
          width: "100%",
          paddingBottom: 10,

          scrollSnapType: "x mandatory",
        }}
      >
        {events.map((event) => {
          const media = event.entry.media;
          const mediaHref = getMediaHref(media, "popular");

          return (
            <a
              key={`${event.id}-${media.externalId || media.id}`}
              href={mediaHref}
              style={{
                width: 190,
                flex: "0 0 auto",
                color: "inherit",
                textDecoration: "none",
                scrollSnapAlign: "start",




              }}
            >
              {media.coverUrl ? (
                <img
                  src={media.coverUrl}
                  alt={media.title}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 190,
                    height: 285,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#eee",
                    display: "block",

                  }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 285,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#666",


                  }}
                >
                  No cover
                </div>
              )}

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 15,
                  lineHeight: 1.2,

                }}
              >
                {media.title}
              </strong>

              {media.releaseDate ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 13,
                    color: "#666",
                    lineHeight: 1.2,

                  }}
                >
                  {formatYear(media.releaseDate)}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function ScopeButton({
  label,
  value,
  activeScope,
  onClick,
  disabled,
}: {
  label: string;
  value: FeedScope;
  activeScope: FeedScope;
  onClick: (scope: FeedScope) => void;
  disabled: boolean;
}) {
  const active = activeScope === value;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      disabled={disabled}
      style={{
        padding: "9px 14px",
        borderRadius: 8,
        border: active ? "1px solid #ff7f7a" : "1px solid #ddd",
        background: active ? "#ffd6d4" : "#fff",
        color: "#111",
        fontWeight: active ? 700 : 600,



        cursor: disabled ? "not-allowed" : "pointer",


      }}
    >
      {label}
    </button>
  );
}

export default function FeedPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [popularAlbumEvents, setPopularAlbumEvents] = useState<FeedEvent[]>([]);
  const [popularTvEvents, setPopularTvEvents] = useState<FeedEvent[]>([]);
  const [popularBookEvents, setPopularBookEvents] = useState<FeedEvent[]>([]);
  const [popularGameEvents, setPopularGameEvents] = useState<FeedEvent[]>([]);
  const [scope, setScope] = useState<FeedScope>("all");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState("");

  async function loadCurrentUser() {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (res.ok && data?.user) {
        setCurrentUser(data.user);
        return data.user as CurrentUser;
      }

      setCurrentUser(null);
      return null;
    } catch {
      setCurrentUser(null);
      return null;
    } finally {
      setAuthLoaded(true);
    }
  }

  async function loadFeedForUser(nextScope: FeedScope = scope) {
    setLoading(true);
    setResult("");

    try {
      const params = new URLSearchParams({
        scope: nextScope,
      });

      if (nextScope === "popular") {
        // Clear old user feed items immediately so the popular tab never
        // shows All/Friends/Mine activity while external rows are loading.
        setEvents([]);
        setPopularAlbumEvents([]);
        setPopularTvEvents([]);
        setPopularBookEvents([]);
        setPopularGameEvents([]);

        const [movieRes, tvRes, albumRes, bookRes, gameRes] = await Promise.all([
          fetch("/api/feed/popular-this-week", {
            cache: "no-store",
          }),
          fetch("/api/feed/popular-tv-this-week", {
            cache: "no-store",
          }),
          fetch("/api/feed/popular-new-albums", {
            cache: "no-store",
          }),
          fetch("/api/feed/popular-books", {
            cache: "no-store",
          }),
          fetch("/api/feed/popular-games", {
            cache: "no-store",
          }),
        ]);

        const movieData = await safeJson(movieRes);
        const tvData = await safeJson(tvRes);
        const albumData = await safeJson(albumRes);
        const bookData = await safeJson(bookRes);
        const gameData = await safeJson(gameRes);

        if (!movieRes.ok || !Array.isArray(movieData)) {
          setEvents([]);
        } else {
          setEvents(movieData);
        }

        if (!tvRes.ok || !Array.isArray(tvData)) {
          setPopularTvEvents([]);
        } else {
          setPopularTvEvents(tvData);
        }

        if (!albumRes.ok || !Array.isArray(albumData)) {
          setPopularAlbumEvents([]);
        } else {
          setPopularAlbumEvents(albumData);
        }

        if (!bookRes.ok || !Array.isArray(bookData)) {
          setPopularBookEvents([]);
        } else {
          setPopularBookEvents(bookData);
        }

        if (!gameRes.ok || !Array.isArray(gameData)) {
          setPopularGameEvents([]);
        } else {
          setPopularGameEvents(gameData);
        }

        setResult("");
        return;
      }

      setPopularAlbumEvents([]);
      setPopularTvEvents([]);
      setPopularBookEvents([]);
      setPopularGameEvents([]);

      const res = await fetch(`/api/feed?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        if (res.status === 401) {
          setResult("");
          setEvents([]);
          return;
        }

        setResult(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to load feed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      if (!Array.isArray(data)) {
        setResult(
          JSON.stringify(
            {
              error: "Feed response was not an array.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setEvents(data);
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            error: "Feed request crashed.",
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

  async function initializeFeed() {
    setLoading(true);
    setResult("");

    const cachedUser = readCachedUser();

    if (!cachedUser) {
      setCurrentUser(null);
      setAuthLoaded(true);
      setScope("popular");
      await loadFeedForUser("popular");
      return;
    }

    setCurrentUser(cachedUser);
    setAuthLoaded(true);
    setScope("all");
    await loadFeedForUser("all");
  }

  function changeScope(nextScope: FeedScope) {
    if (nextScope !== "popular" && !currentUser) {
      setScope("popular");
      setResult("");
      return;
    }

    setScope(nextScope);
    loadFeedForUser(nextScope);
  }

  function refreshFeed() {
    if (scope === "popular") {
      loadFeedForUser(scope);
      return;
    }

    if (!currentUser) {
      setResult("Please log in to use your feed.");
      return;
    }

    loadFeedForUser(scope);
  }

  useEffect(() => {
    initializeFeed();
  }, []);

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
        boxSizing: "border-box",
        background: "#f7f8fa",
        minHeight: "100vh",
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
          Feed
        </h1>

        {!authLoaded ? null : currentUser ? (
          <p style={{ color: "#555", marginTop: 10 }}>
            Recent activity for{" "}
            <strong>
              {currentUser.displayName || currentUser.username} (@
              {currentUser.username})
            </strong>
            .
          </p>
        ) : (
          <p style={{ color: "#555", marginTop: 10 }}>
            Browse popular movies, shows, albums, books, and games.
          </p>
        )}
      </section>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 0,
          flexWrap: "wrap",
          background: "#ffe2df",
          padding: "16px 48px",
          borderBottom: "1px solid #f0c9c6",
        }}
      >
        {currentUser ? (
          <>
            <ScopeButton
              label="All"
              value="all"
              activeScope={scope}
              onClick={changeScope}
              disabled={loading || (scope !== "popular" && !currentUser)}
            />

            <ScopeButton
              label="Friends"
              value="friends"
              activeScope={scope}
              onClick={changeScope}
              disabled={loading || !currentUser}
            />

            <ScopeButton
              label="Mine"
              value="me"
              activeScope={scope}
              onClick={changeScope}
              disabled={loading || !currentUser}
            />
          </>
        ) : null}

        <ScopeButton
          label="Popular This Week"
          value="popular"
          activeScope={scope}
          onClick={changeScope}
          disabled={loading}
        />

        <button
          type="button"
          onClick={refreshFeed}
          disabled={loading || !currentUser}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            marginLeft: 8,
            cursor:
              loading || (scope !== "popular" && !currentUser)
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {result && scope !== "popular" ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#fff",
            padding: 14,
            borderRadius: 8,
            margin: "24px 48px 0",
            border: "1px solid #ddd",



          }}
        >
          {result}
        </pre>
      ) : null}

      {!loading && events.length === 0 && !result && (
        <div
          style={{
            margin: "28px 48px",
            padding: 24,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,

          }}
        >
          <p style={{ margin: 0 }}>{getEmptyMessage(scope)}</p>



















        </div>
      )}

      {scope === "popular" ? (
        <section
          style={{
            padding: "28px 48px 40px",
            background: "#f7f8fa",
          }}
        >
          <PopularLoadingMessage loading={loading} />
          <PopularMovieScroller events={events} />
          <PopularTvScroller events={popularTvEvents} />
          <PopularAlbumScroller events={popularAlbumEvents} />
          <PopularBookScroller events={popularBookEvents} />
          <PopularGameScroller events={popularGameEvents} />
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            padding: "28px 48px 40px",
            background: "#f7f8fa",
          }}
        >
          {events.map((event) => {
            const media = event.entry.media;
            const user = event.entry.user;
            const reviewText = event.bodyText || event.entry.reviewText;
            const mediaHref = getMediaHref(media, scope);

            return (
              <article
                key={`${event.id}-${media.externalId || media.id}`}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 14,
                  padding: 16,
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                  background: "#fff",

                }}
              >
                <a href={mediaHref} style={{ textDecoration: "none" }}>
                  <MediaCoverCard media={media} />
                </a>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 8, lineHeight: 1.4 }}>







                    <a
                      href={`/profiles/${user.username}`}
                      style={{ color: "#111", textDecoration: "none" }}




                    >
                      <strong>
                        {user.displayName || user.username || "Unknown user"}
                      </strong>
                    </a>{" "}
                    {formatEventType(event.eventType)}{" "}


                    <a
                      href={mediaHref}
                      style={{ color: "#d95d59", textDecoration: "none" }}




                    >
                      <strong>{media.title}</strong>
                    </a>
                  </div>

                  <MediaMeta media={media} />

                  {event.ratingValue !== null && (
                    <p style={{ marginTop: 12, marginBottom: 0 }}>







                      Rating: <strong>{event.ratingValue}/10</strong>
                    </p>
                  )}

                  {reviewText && (
                    <p
                      style={{
                        marginTop: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.45,
                        background: "#fafafa",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #eee",

                      }}
                    >
                      {reviewText}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      color: "#777",
                      fontSize: 13,
                    }}
                  >
                    {formatDate(event.createdAt)}
                  </div>

                  <div style={{ marginTop: 12 }}>









                    <a
                      href={mediaHref}
                      style={{ color: "#d95d59", textDecoration: "none" }}



                    >
                      View Media
                    </a>
                    {" | "}
                    <a
                      href={`/profiles/${user.username}`}
                      style={{ color: "#d95d59", textDecoration: "none" }}



                    >
                      View Profile
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
