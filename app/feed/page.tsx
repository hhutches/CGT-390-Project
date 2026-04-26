"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type FeedScope = "all" | "friends" | "me";

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

function getEmptyMessage(scope: FeedScope) {
  if (scope === "friends") {
    return "No friend activity yet. Once your friends log media, it will show here.";
  }

  if (scope === "me") {
    return "You have not logged anything yet.";
  }

  return "No feed activity yet.";
}

function MediaCoverCard({ media }: { media: Media }) {
  if (media.type === "ALBUM") {
    return (
      <div
        style={{
          width: 160,
          height: 240,
          border: "1px solid #ccc",
          borderRadius: 8,
          overflow: "hidden",
          background: "white",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 40,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
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
            <span style={{ fontSize: 12 }}>No cover</span>
          )}
        </div>

        <div
          style={{
            height: 40,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
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
          borderRadius: 8,
          flexShrink: 0,
          border: "1px solid #ccc",
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
        border: "1px solid #ccc",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "#eee",
        fontSize: 12,
      }}
    >
      No cover
    </div>
  );
}

function MediaMeta({ media }: { media: Media }) {
  const year = formatYear(media.releaseDate);

  return (
    <div style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
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
        padding: "8px 12px",
        borderRadius: 8,
        border: active ? "2px solid black" : "1px solid #ccc",
        background: active ? "#f0f0f0" : "white",
        fontWeight: active ? 700 : 400,
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

  async function loadFeedForUser(userId: string, nextScope: FeedScope = scope) {
    setLoading(true);
    setResult("");

    try {
      const params = new URLSearchParams({
        userId,
        scope: nextScope,
      });

      const res = await fetch(`/api/feed?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
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

    const user = await loadCurrentUser();

    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    await loadFeedForUser(user.id, "all");
  }

  function changeScope(nextScope: FeedScope) {
    setScope(nextScope);

    if (!currentUser) {
      setResult("Please log in to use your feed.");
      return;
    }

    loadFeedForUser(currentUser.id, nextScope);
  }

  function refreshFeed() {
    if (!currentUser) {
      setResult("Please log in to use your feed.");
      return;
    }

    loadFeedForUser(currentUser.id, scope);
  }

  useEffect(() => {
    initializeFeed();
  }, []);

  if (authLoaded && !currentUser) {
    return (
      <main style={{ padding: 40, maxWidth: 900 }}>
        <h1>Feed</h1>

        <div
          style={{
            border: "1px solid #f0b4b4",
            background: "#fff5f5",
            padding: 14,
            borderRadius: 10,
            marginTop: 16,
          }}
        >
          <p style={{ color: "#900", marginTop: 0 }}>
            You are not logged in. Log in or create an account to view your
            feed.
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
      </main>
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1>Feed</h1>

      {!authLoaded ? (
        <p style={{ color: "#555" }}>Checking login...</p>
      ) : currentUser ? (
        <p style={{ color: "#555" }}>
          Recent activity for{" "}
          <strong>
            {currentUser.displayName || currentUser.username} (@
            {currentUser.username})
          </strong>
          .
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <ScopeButton
          label="All"
          value="all"
          activeScope={scope}
          onClick={changeScope}
          disabled={loading || !currentUser}
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

        <button
          type="button"
          onClick={refreshFeed}
          disabled={loading || !currentUser}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            marginLeft: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {result && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {result}
        </pre>
      )}

      {!loading && events.length === 0 && !result && (
        <p>{getEmptyMessage(scope)}</p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {events.map((event) => {
          const media = event.entry.media;
          const user = event.entry.user;
          const reviewText = event.bodyText || event.entry.reviewText;

          return (
            <article
              key={event.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                gap: 18,
                alignItems: "flex-start",
                background: "white",
              }}
            >
              <a href={`/media/${media.id}`} style={{ textDecoration: "none" }}>
                <MediaCoverCard media={media} />
              </a>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <a
                    href={`/profiles/${user.username}`}
                    style={{ color: "inherit" }}
                  >
                    <strong>
                      {user.displayName || user.username || "Unknown user"}
                    </strong>
                  </a>{" "}
                  {formatEventType(event.eventType)}{" "}
                  <a href={`/media/${media.id}`}>
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
                  <a href={`/media/${media.id}`}>View Media</a>
                  {" | "}
                  <a href={`/profiles/${user.username}`}>View Profile</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}