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

export default function LogoutPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Logout failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      window.location.href = "/login";
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Logout request crashed.",
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
      <h1>Log Out</h1>

      <p style={{ color: "#555" }}>
        Log out of the current account so you can test another user.
      </p>

      <button
        type="button"
        onClick={logout}
        disabled={loading}
        style={{ padding: "8px 12px" }}
      >
        {loading ? "Logging out..." : "Log Out"}
      </button>

      <p style={{ marginTop: 20 }}>
        <a href="/login">Back to Login</a>
        {" | "}
        <a href="/signup">Create Test User</a>
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