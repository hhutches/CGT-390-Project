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

export default function SignupPage() {
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

      window.location.href = `/profiles/${data.user.username}`;
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
    <main style={{ padding: 40, maxWidth: 520 }}>
      <h1>Create Account</h1>

      <p style={{ color: "#555" }}>
        Sign up to create a profile, log media, add friends, and use your own feed.
      </p>

      <form onSubmit={handleSubmit}>
        <label>Username</label>
        <br />
        <input
          name="username"
          required
          minLength={3}
          maxLength={24}
          placeholder="username"
          style={{ padding: 8, width: "100%", marginBottom: 14 }}
        />

        <label>Display name</label>
        <br />
        <input
          name="displayName"
          placeholder="Display Name"
          style={{ padding: 8, width: "100%", marginBottom: 14 }}
        />

        <label>Email</label>
        <br />
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          style={{ padding: 8, width: "100%", marginBottom: 14 }}
        />

        <label>Password</label>
        <br />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          style={{ padding: 8, width: "100%", marginBottom: 18 }}
        />

        <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>

      <p style={{ marginTop: 20 }}>
        Already have an account? <a href="/login">Log in</a>
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