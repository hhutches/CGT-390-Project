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

export default function SignupPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.get("username"),
          displayName: form.get("displayName"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.user) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Signup failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      cacheAuthUser(data.user);
      router.push(`/profiles/${data.user.username}`);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Signup request crashed.",
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
    <main
      style={{
        minHeight: "100vh",
        padding: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
                "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.28), transparent 28%), radial-gradient(circle at 85% 85%, rgba(255,255,255,0.32), transparent 30%)",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 920,
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
            background: "#ffe2df",
            borderRight: "1px solid #f0c9c6",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              color: "#d95d59",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
            }}
          >
            Get started
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 46,
              lineHeight: 1.05,
            }}
          >
            Create your media profile.
          </h1>

          <p
            style={{
              marginTop: 18,
              maxWidth: 440,
              color: "#555",
              fontSize: 17,
              lineHeight: 1.5,
            }}
          >
            Sign up to create a profile, log media, add friends, set your top
            favorites, and build your own feed.
          </p>
        </div>

        <div
          style={{
            padding: 38,
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
              Create Account
            </h2>

            <p
              style={{
                marginTop: 8,
                color: "#666",
                lineHeight: 1.45,
              }}
            >
              Enter your information below to start tracking your media.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              required
              minLength={3}
              maxLength={24}
              placeholder="username"
              autoComplete="username"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
                marginBottom: 16,
                background: "#fff",
              }}
            />

            <label
              htmlFor="displayName"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Display name
            </label>

            <input
              id="displayName"
              name="displayName"
              placeholder="Display Name"
              autoComplete="name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
                marginBottom: 16,
                background: "#fff",
              }}
            />

            <label
              htmlFor="email"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
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
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 15,
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
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p
            style={{
              marginTop: 22,
              marginBottom: 0,
              color: "#666",
              textAlign: "center",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              style={{
                color: "#d95d59",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Log in
            </Link>
          </p>

          {message && (
            <pre
              style={{
                marginTop: 20,
                whiteSpace: "pre-wrap",
                background: "#fff5f5",
                color: "#900",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #f0b4b4",
              }}
            >
              {message}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}
