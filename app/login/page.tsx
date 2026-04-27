"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AUTH_CACHE_KEY = "media_app_current_user_cache";

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

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
        minHeight: "calc(100vh - 70px)",
        padding: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #f1f1f1 0, #ffffff 34%, #f7f7f7 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 420px",
          border: "1px solid #ddd",
          borderRadius: 28,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 24px 70px rgba(0,0,0,0.10)",
        }}
      >
        <div
          style={{
            padding: 42,
            background:
              "linear-gradient(135deg, #050505 0%, #222 42%, #6b4eff 100%)",
            color: "white",
            minHeight: 480,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 11px",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 999,
                background: "rgba(255,255,255,0.10)",
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 28,
              }}
            >
              Media App
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 46,
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
              }}
            >
              Welcome back.
            </h1>

            <p
              style={{
                marginTop: 18,
                maxWidth: 440,
                color: "rgba(255,255,255,0.78)",
                fontSize: 17,
                lineHeight: 1.55,
              }}
            >
              Log in to rate, review, track your media, manage favorites, and
              see what your friends are watching, reading, playing, and
              listening to.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 34,
            }}
          >
            {["Reviews", "Favorites", "Friends"].map((label) => (
              <div
                key={label}
                style={{
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: 14,
                  backdropFilter: "blur(14px)",
                }}
              >
                <strong style={{ display: "block", fontSize: 14 }}>
                  {label}
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 12,
                    lineHeight: 1.25,
                  }}
                >
                  Track your taste
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 38,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ marginBottom: 26 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 30,
                letterSpacing: "-0.035em",
              }}
            >
              Log in
            </h2>

            <p style={{ marginTop: 8, color: "#666", lineHeight: 1.45 }}>
              Use your username or email to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="identifier"
              style={{
                display: "block",
                fontWeight: 800,
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
                padding: "13px 14px",
                border: "1px solid #ccc",
                borderRadius: 14,
                fontSize: 15,
                outline: "none",
                marginBottom: 16,
                background: "#fafafa",
              }}
            />

            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: 800,
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
                padding: "13px 14px",
                border: "1px solid #ccc",
                borderRadius: 14,
                fontSize: 15,
                outline: "none",
                marginBottom: 18,
                background: "#fafafa",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 14px",
                border: "1px solid #111",
                borderRadius: 14,
                background: loading ? "#444" : "black",
                color: "white",
                fontWeight: 900,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 12px 24px rgba(0,0,0,0.16)",
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
                borderRadius: 14,
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
                color: "black",
                fontWeight: 900,
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