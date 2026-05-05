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
            Set Top 4 Favorites
          </h1>

          <p
            style={{
              color: "#555",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            You need to log in before editing favorites.
          </p>
        </section>

        <section
          style={{
            margin: "28px 48px",
            padding: 24,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
          }}
        >
          <p
            style={{
              marginTop: 0,
              color: "#555",
              lineHeight: 1.5,
            }}
          >
            Log in or create an account to set your favorite movies, shows,
            books, albums, and games.
          </p>

          <p style={{ marginBottom: 0 }}>
            <a
              href="/login"
              style={{
                color: "#d95d59",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Log In
            </a>
            {" | "}
            <a
              href="/signup"
              style={{
                color: "#d95d59",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign Up
            </a>
          </p>

          {message && (
            <pre
              style={{
                marginTop: 20,
                whiteSpace: "pre-wrap",
                background: "#f7f8fa",
                padding: 14,
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            >
              {message}
            </pre>
          )}
        </section>
      </main>
    );
  }

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
          Set Top 4 Favorites
        </h1>

        {currentUser && (
          <p
            style={{
              color: "#555",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Editing favorites for{" "}
            <strong>
              {currentUser.displayName || currentUser.username} (@
              {currentUser.username})
            </strong>
          </p>
        )}
      </section>

      <div
        style={{
          padding: "28px 48px 40px",
        }}
      >
        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Current Favorites</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            {[1, 2, 3, 4].map((slot) => {
              const favorite = favorites.find((item) => item.slotNumber === slot);

              return (
                <div
                  key={slot}
                  style={{
                    border:
                      selectedSlot === slot
                        ? "2px solid #ff7f7a"
                        : "1px solid #ddd",
                    borderRadius: 12,
                    padding: 14,
                    background: selectedSlot === slot ? "#fff2f1" : "#fff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 8,
                      color: selectedSlot === slot ? "#d95d59" : "#111",
                    }}
                  >
                    Slot {slot}
                  </div>

                  {favorite ? (
                    <>
                      <a
                        href={`/media/${favorite.media.id}`}
                        style={{
                          color: "#111",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {favorite.media.title}
                      </a>

                      <p
                        style={{
                          margin: "6px 0 12px",
                          color: "#555",
                          fontSize: 14,
                        }}
                      >
                        {favorite.media.type}
                        {favorite.media.releaseDate && (
                          <span> · {formatYear(favorite.media.releaseDate)}</span>
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => clearFavorite(slot)}
                        disabled={loading}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "#fff",
                          cursor: loading ? "not-allowed" : "pointer",
                          marginRight: 8,
                        }}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <p
                      style={{
                        margin: "0 0 12px",
                        color: "#777",
                        fontSize: 14,
                      }}
                    >
                      Empty
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    disabled={loading}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #ff7f7a",
                      background: selectedSlot === slot ? "#ff7f7a" : "#ffe2df",
                      color: selectedSlot === slot ? "#fff" : "#111",
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Use this slot
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>
            Add / Replace Favorite
          </h2>

          <p
            style={{
              marginTop: 0,
              color: "#555",
            }}
          >
            Selected slot: <strong>{selectedSlot}</strong>
          </p>

          <label style={{ fontWeight: 600 }}>Search local media</label>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              searchMedia();
            }}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search imported media..."
              style={{
                padding: 10,
                width: 340,
                maxWidth: "100%",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
              }}
            />

            <button
              type="submit"
              disabled={loading || !currentUser}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ff7f7a",
                background: "#ff7f7a",
                color: "white",
                fontWeight: 700,
                cursor: loading || !currentUser ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </form>

          <div
            style={{
              marginTop: 18,
              border:
                results.length > 0 ? "1px solid #ddd" : "none",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
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
                  padding: 14,
                  border: "none",
                  borderBottom: "1px solid #ddd",
                  background: selectedMedia?.id === item.id ? "#fff2f1" : "#fff",
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
            <p
              style={{
                background: "#fff2f1",
                border: "1px solid #ffd6d4",
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
              }}
            >
              Selected media: <strong>{selectedMedia.title}</strong>
            </p>
          )}

          <button
            type="button"
            onClick={saveFavorite}
            disabled={!selectedMedia || loading || !currentUser}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ff7f7a",
              background: !selectedMedia || !currentUser ? "#ddd" : "#ff7f7a",
              color: !selectedMedia || !currentUser ? "#666" : "white",
              fontWeight: 700,
              cursor:
                !selectedMedia || loading || !currentUser
                  ? "not-allowed"
                  : "pointer",
              marginTop: 16,
            }}
          >
            Save Favorite to Slot {selectedSlot}
          </button>
        </section>

        <div style={{ marginTop: 20 }}>
          {currentUser && (
            <>
              <a
                href={`/profiles/${currentUser.username}`}
                style={{
                  color: "#d95d59",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Go to My Profile
              </a>
              {" | "}
            </>
          )}

          <a
            href="/feed"
            style={{
              color: "#d95d59",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Go to Feed
          </a>
          {" | "}
          <a
            href="/logout"
            style={{
              color: "#d95d59",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Log Out
          </a>
        </div>

        {message ? (
          <pre
            style={{
              marginTop: 20,
              whiteSpace: "pre-wrap",
              background: "#fff",
              padding: 14,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            {message}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
