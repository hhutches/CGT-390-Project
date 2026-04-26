"use client";

import { useState } from "react";

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

export default function LoginPage() {
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
          JSON.stringify(
            {
              status: res.status,
              error: "Login failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      window.location.href = `/profiles/${data.user.username}`;
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Login request crashed.",
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
    <main style={{ padding: 40, maxWidth: 520 }}>
      <h1>Log In</h1>

      <p style={{ color: "#555" }}>
        Log in to use your own profile, friends, feed, entries, and favorites.
      </p>

      <form onSubmit={handleSubmit}>
        <label>Username or email</label>
        <br />
        <input
          name="identifier"
          required
          placeholder="username or email"
          style={{ padding: 8, width: "100%", marginBottom: 14 }}
        />

        <label>Password</label>
        <br />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          style={{ padding: 8, width: "100%", marginBottom: 18 }}
        />

        <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p style={{ marginTop: 20 }}>
        Need an account? <a href="/signup">Sign up</a>
      </p>

      {message && (
        <pre
          style={{
            marginTop: 20,
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {message}
        </pre>
      )}
    </main>
  );
}