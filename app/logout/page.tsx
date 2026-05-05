"use client";

import { useEffect } from "react";

const AUTH_CACHE_KEY = "media_app_current_user_cache";
const AUTH_CHANGED_EVENT = "media-app-auth-changed";

export default function LogoutPage() {
  useEffect(() => {
    async function logout() {
      try {
        window.sessionStorage.removeItem(AUTH_CACHE_KEY);
        window.localStorage.removeItem(AUTH_CACHE_KEY);
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      } catch {
        // Ignore storage errors.
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 2500);

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (error) {
        console.error("Logout request failed or timed out:", error);
      } finally {
        window.clearTimeout(timeoutId);
        window.location.replace("/login");
      }
    }

    logout();
  }, []);

  return (
    <main
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        background: "#f7f8fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 18,
          padding: 34,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "4px solid #ffe2df",
            borderTopColor: "#ff7f7a",
            margin: "0 auto 18px",
          }}
        />

        <p
          style={{
            margin: "0 0 8px",
            color: "#d95d59",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: 13,
          }}
        >
          Signing out
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: 34,
            lineHeight: 1.1,
          }}
        >
          Logging out...
        </h1>

        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            color: "#555",
            lineHeight: 1.5,
          }}
        >
          Clearing your session and sending you back to the login page.
        </p>
      </section>
    </main>
  );
}
