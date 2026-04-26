"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type MediaResult = {
  id: number;
  title: string;
  type: string;
  releaseDate: string | null;
  coverUrl?: string | null;
};

type Favorite = {
  userId: string;
  slotNumber: number;
  mediaId: number;
  media: MediaResult;
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

function formatYear(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 4);
  }

  return String(date.getFullYear());
}

export default function FavoritesPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCurrentUser() {
    const res = await fetch("/api/auth/me", {
      cache: "no-store",
    });

    const data = await safeJson(res);

    if (!res.ok || !data?.user) {
      setCurrentUser(null);
      setMessage("Please log in to edit favorites.");
      return null;
    }

    setCurrentUser(data.user);
    return data.user as CurrentUser;
  }

  async function loadFavorites(userId: string) {
    const res = await fetch(`/api/favorites?userId=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });

    const data = await safeJson(res);

    if (!res.ok || !Array.isArray(data)) {
      setMessage(
        JSON.stringify(
          {
            status: res.status,
            error: "Failed to load favorites.",
            response: data,
          },
          null,
          2
        )
      );
      return;
    }

    setFavorites(data);
  }

  async function initializePage() {
    setLoading(true);
    setMessage("");

    try {
      const user = await loadCurrentUser();

      if (user) {
        await loadFavorites(user.id);
      }
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Failed to initialize favorites page.",
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
    initializePage();
  }, []);

  async function searchMedia() {
    if (!currentUser) {
      setMessage("Please log in first.");
      return;
    }

    if (!query.trim()) {
      setMessage("Enter a search term.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query)}`);
      const data = await safeJson(res);

      if (!res.ok) {
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

      if (!Array.isArray(data)) {
        setMessage(
          JSON.stringify(
            {
              error: "Search response was not an array.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setResults(data);
    } catch (error) {
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

  async function saveFavorite() {
    if (!currentUser) {
      setMessage("Please log in first.");
      return;
    }

    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const payload = {
      userId: currentUser.id,
      mediaId: selectedMedia.id,
      slotNumber: selectedSlot,
    };

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to save favorite.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setMessage(
        `Saved "${selectedMedia.title}" to favorite slot ${selectedSlot} for @${currentUser.username}.`
      );

      setSelectedMedia(null);
      setResults([]);
      setQuery("");

      await loadFavorites(currentUser.id);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Save favorite request crashed.",
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

  async function clearFavorite(slot: number) {
    if (!currentUser) {
      setMessage("Please log in first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/favorites?userId=${encodeURIComponent(
          currentUser.id
        )}&slotNumber=${slot}`,
        {
          method: "DELETE",
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to clear favorite.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setMessage(`Cleared slot ${slot} for @${currentUser.username}.`);

      await loadFavorites(currentUser.id);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Clear favorite request crashed.",
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

  if (!currentUser && !loading) {
    return (
      <main style={{ padding: 40, maxWidth: 850 }}>
        <h1>Set Top 4 Favorites</h1>
        <p>You need to log in before editing favorites.</p>
        <p>
          <a href="/login">Log In</a>
          {" | "}
          <a href="/signup">Sign Up</a>
        </p>

        {message && (
          <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>{message}</pre>
        )}
      </main>
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 850 }}>
      <h1>Set Top 4 Favorites</h1>

      {currentUser && (
        <p style={{ color: "#555" }}>
          Editing favorites for{" "}
          <strong>
            {currentUser.displayName || currentUser.username} (@
            {currentUser.username})
          </strong>
        </p>
      )}

      <section style={{ marginBottom: 30 }}>
        <h2>Current Favorites</h2>

        {[1, 2, 3, 4].map((slot) => {
          const favorite = favorites.find((item) => item.slotNumber === slot);

          return (
            <div
              key={slot}
              style={{
                border:
                  selectedSlot === slot ? "2px solid black" : "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                background: selectedSlot === slot ? "#f5f5f5" : "white",
              }}
            >
              <strong>Slot {slot}:</strong>{" "}
              {favorite ? (
                <>
                  <a href={`/media/${favorite.media.id}`}>
                    {favorite.media.title}
                  </a>{" "}
                  ({favorite.media.type}){" "}
                  {favorite.media.releaseDate && (
                    <span>— {formatYear(favorite.media.releaseDate)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => clearFavorite(slot)}
                    disabled={loading}
                    style={{ marginLeft: 10 }}
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span>Empty</span>
              )}

              <button
                type="button"
                onClick={() => setSelectedSlot(slot)}
                disabled={loading}
                style={{ marginLeft: 10 }}
              >
                Use this slot
              </button>
            </div>
          );
        })}
      </section>

      <section style={{ marginBottom: 30 }}>
        <h2>Add / Replace Favorite</h2>

        <p>
          Selected slot: <strong>{selectedSlot}</strong>
        </p>

        <label>Search local media</label>
        <br />

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search imported media..."
          style={{ padding: 8, width: 300 }}
        />

        <button
          type="button"
          onClick={searchMedia}
          disabled={loading || !currentUser}
          style={{ marginLeft: 10, padding: 8 }}
        >
          {loading ? "Loading..." : "Search"}
        </button>

        <div style={{ marginTop: 16 }}>
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedMedia(item)}
              disabled={loading}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 12,
                marginBottom: 8,
                border:
                  selectedMedia?.id === item.id
                    ? "2px solid black"
                    : "1px solid #ccc",
                borderRadius: 8,
                background: "white",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <strong>{item.title}</strong> ({item.type})
              {item.releaseDate && (
                <span> — {formatYear(item.releaseDate)}</span>
              )}
            </button>
          ))}
        </div>

        {selectedMedia && (
          <p>
            Selected media: <strong>{selectedMedia.title}</strong>
          </p>
        )}

        <button
          type="button"
          onClick={saveFavorite}
          disabled={!selectedMedia || loading || !currentUser}
        >
          Save Favorite to Slot {selectedSlot}
        </button>
      </section>

      <div style={{ marginTop: 20 }}>
        {currentUser && (
          <>
            <a href={`/profiles/${currentUser.username}`}>Go to My Profile</a>
            {" | "}
          </>
        )}
        <a href="/feed">Go to Feed</a>
        {" | "}
        <a href="/logout">Log Out</a>
      </div>

      <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>{message}</pre>
    </main>
  );
}