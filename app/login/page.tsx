"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const AUTH_CACHE_KEY = "media_app_current_user_cache";

type PopularItem = {
  id: string;
  title: string;
  type: string;
  imageUrl: string | null;
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

function cacheAuthUser(user: unknown) {
  try {
    window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("media-app-auth-changed"));
  } catch {
    // Ignore storage failures.
  }
}

function getPopularItemsFromFeed(data: any, fallbackType: string): PopularItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((event: any) => {
      const media = event?.entry?.media;

      if (!media?.title) return null;

      return {
        id: String(media.externalId || media.id || event.id || media.title),
        title: String(media.title),
        type: String(media.type || fallbackType),
        imageUrl: media.coverUrl || null,
      };
    })
    .filter((item: PopularItem | null): item is PopularItem =>
      Boolean(item?.imageUrl)
    );
}

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPopularItems() {
      try {
        const [moviesRes, albumsRes] = await Promise.allSettled([
          fetch("/api/feed/popular-this-week", { cache: "no-store" }),
          fetch("/api/feed/popular-new-albums", { cache: "no-store" }),
        ]);

        const moviesData =
          moviesRes.status === "fulfilled"
            ? await safeJson(moviesRes.value)
            : null;

        const albumsData =
          albumsRes.status === "fulfilled"
            ? await safeJson(albumsRes.value)
            : null;

        const movieItems = getPopularItemsFromFeed(moviesData, "MOVIE").slice(
          0,
          10
        );
        const albumItems = getPopularItemsFromFeed(albumsData, "ALBUM").slice(
          0,
          10
        );

        const combined = [...movieItems, ...albumItems];

        if (!cancelled) {
          setPopularItems(combined);
        }
      } catch {
        if (!cancelled) {
          setPopularItems([]);
        }
      }
    }

    loadPopularItems();

    return () => {
      cancelled = true;
    };
  }, []);

  const tickerItems = useMemo(() => {
    if (popularItems.length === 0) return [];

    return [...popularItems, ...popularItems];
  }, [popularItems]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.user) {
        setMessage(
          data?.error ||
            data?.message ||
            "Login failed. Check your username/email and password."
        );
        return;
      }

      cacheAuthUser(data.user);
      router.push(`/profiles/${data.user.username}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f8fa",
        boxSizing: "border-box",
      }}
    >
      <style>
        {`
          @keyframes loginTickerScroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}
      </style>

      <section
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 420px",
          border: "1px solid #ddd",
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            padding: 40,
            background:
              "linear-gradient(135deg, #ff7f7a 0%, #d95d59 45%, #ffe2df 100%)",
            color: "white",
            minHeight: 480,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
            borderRight: "1px solid #f0c9c6",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.28), transparent 28%), radial-gradient(circle at 85% 85%, rgba(255,255,255,0.32), transparent 30%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
              }}
            >
              Welcome back
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 46,
                lineHeight: 1.05,
              }}
            >
              Log in to your media tracker.
            </h1>

            <p
              style={{
                marginTop: 18,
                maxWidth: 440,
                color: "rgba(255,255,255,0.9)",
                fontSize: 17,
                lineHeight: 1.5,
              }}
            >
              Log in to rate, review, track your media, manage favorites, and
              see what your friends are watching, reading, playing, and
              listening to.
            </p>
          </div>

          {tickerItems.length > 0 ? (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                marginTop: 32,
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                Popular right now
              </p>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.22)",
                  borderRadius: 14,
                  padding: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "max-content",
                    gap: 10,
                    animation: "loginTickerScroll 34s linear infinite",
                  }}
                >
                  {tickerItems.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      title={item.title}
                      style={{
                        width: item.type === "ALBUM" ? 86 : 76,
                        height: item.type === "ALBUM" ? 86 : 114,
                        flex: "0 0 auto",
                        border: "1px solid rgba(255,255,255,0.45)",
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
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
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: 38,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "#fff",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 30,
              }}
            >
              Log in
            </h2>

            <p
              style={{
                marginTop: 8,
                color: "#666",
                lineHeight: 1.45,
              }}
            >
              Use your username or email to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="identifier"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Username or email
            </label>

            <input
              id="identifier"
              name="identifier"
              required
              placeholder="username or email"
              autoComplete="username"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
                outline: "none",
                marginBottom: 16,
                background: "#fff",
              }}
            />

            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Password"
              autoComplete="current-password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
                outline: "none",
                marginBottom: 18,
                background: "#fff",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ff7f7a",
                borderRadius: 8,
                background: loading ? "#f0b7b3" : "#ff7f7a",
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          {message ? (
            <div
              style={{
                marginTop: 18,
                border: "1px solid #f0b4b4",
                background: "#fff5f5",
                color: "#900",
                padding: 12,
                borderRadius: 8,
                lineHeight: 1.4,
                fontSize: 14,
              }}
            >
              {message}
            </div>
          ) : null}

          <p
            style={{
              marginTop: 22,
              marginBottom: 0,
              color: "#666",
              textAlign: "center",
            }}
          >
            Need an account?{" "}
            <Link
              href="/signup"
              style={{
                color: "#d95d59",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign up
            </Link>
          </p>

          <p
            style={{
              marginTop: 14,
              marginBottom: 0,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            <Link
              href="/"
              style={{
                color: "#777",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Browse popular media first
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
