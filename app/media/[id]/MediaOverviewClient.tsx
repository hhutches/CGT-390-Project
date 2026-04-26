"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
};

type Props = {
  mediaId: string;
  mediaType: string;
  existingEntry?: {
    id?: string;
    status?: string | null;
    rating?: number | null;
    review?: string | null;
  } | null;
};

function getCopy(type: string) {
  if (type === "MOVIE") {
    return {
      wishlist: "Want to watch",
      inProgress: null,
      completed: "Watched",
      review: "Review movie",
      placeholder: "What did you think of this movie?",
    };
  }

  if (type === "SHOW") {
    return {
      wishlist: "Want to watch",
      inProgress: "Watching",
      completed: "Watched",
      review: "Review show",
      placeholder: "What did you think of this show?",
    };
  }

  if (type === "BOOK") {
    return {
      wishlist: "Want to read",
      inProgress: "Reading",
      completed: "Read",
      review: "Review book",
      placeholder: "What did you think of this book?",
    };
  }

  if (type === "ALBUM") {
    return {
      wishlist: "Want to listen",
      inProgress: null,
      completed: "Listened",
      review: "Review album",
      placeholder: "What did you think of this album?",
    };
  }

  if (type === "GAME") {
    return {
      wishlist: "Want to play",
      inProgress: "Playing",
      completed: "Played",
      review: "Review game",
      placeholder: "What did you think of this game?",
    };
  }

  return {
    wishlist: "Want to check out",
    inProgress: "In progress",
    completed: "Done",
    review: "Review",
    placeholder: "What did you think?",
  };
}

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function MediaActions({
  mediaId,
  mediaType,
  existingEntry = null,
}: Props) {
  const copy = getCopy(mediaType);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [status, setStatus] = useState(existingEntry?.status || "");
  const [rating, setRating] = useState(existingEntry?.rating || 0);
  const [review, setReview] = useState(existingEntry?.review || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await safeJson(response);

        if (!cancelled && response.ok && data?.user) {
          setCurrentUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoaded(true);
        }
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(nextStatus = status || "COMPLETED") {
    setSaving(true);
    setMessage("");

    try {
      if (!currentUser?.id) {
        throw new Error("Please log in to add, rate, or review this.");
      }

      const numericMediaId = Number(mediaId);

      if (!Number.isInteger(numericMediaId) || numericMediaId <= 0) {
        throw new Error("Invalid media item.");
      }

      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          mediaId: numericMediaId,
          status: nextStatus,
          ratingValue: rating || null,
          reviewText: review.trim() || null,
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save entry.");
      }

      setStatus(nextStatus);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function StatusButton({
    value,
    label,
  }: {
    value: string;
    label: string;
  }) {
    const active = status === value;

    return (
      <button
        type="button"
        disabled={saving || !authLoaded || !currentUser}
        onClick={() => save(value)}
        style={{
          padding: "9px 12px",
          borderRadius: 8,
          border: active ? "2px solid black" : "1px solid #ccc",
          background: active ? "#f0f0f0" : "white",
          fontWeight: active ? 700 : 500,
          cursor: saving || !currentUser ? "not-allowed" : "pointer",
        }}
      >
        {active ? "✓ " : ""}
        {label}
      </button>
    );
  }

  return (
    <section
      style={{
        border: "1px solid #ccc",
        borderRadius: 12,
        padding: 18,
        background: "white",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Add / Rate / Review</h2>

      {!authLoaded ? (
        <p style={{ marginTop: 0, color: "#666" }}>Checking login...</p>
      ) : !currentUser ? (
        <p style={{ marginTop: 0, color: "#900" }}>
          Please <a href="/login">log in</a> to add, rate, or review this.
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatusButton value="WISHLIST" label={copy.wishlist} />

        {copy.inProgress ? (
          <StatusButton value="IN_PROGRESS" label={copy.inProgress} />
        ) : null}

        <StatusButton value="COMPLETED" label={copy.completed} />
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "block",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Rating: {rating ? `${rating}/10` : "No rating"}
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              disabled={!currentUser || saving}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: rating === value ? "2px solid black" : "1px solid #ccc",
                background: rating === value ? "#f0f0f0" : "white",
                fontWeight: rating === value ? 700 : 400,
                cursor: !currentUser || saving ? "not-allowed" : "pointer",
              }}
            >
              {value}
            </button>
          ))}

          {rating ? (
            <button
              type="button"
              onClick={() => setRating(0)}
              disabled={!currentUser || saving}
              style={{
                padding: "0 10px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "white",
                cursor: !currentUser || saving ? "not-allowed" : "pointer",
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label
          htmlFor="review-text"
          style={{
            display: "block",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {copy.review}
        </label>

        <textarea
          id="review-text"
          value={review}
          onChange={(event) => setReview(event.target.value)}
          rows={2}
          disabled={!currentUser || saving}
          placeholder={copy.placeholder}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            font: "inherit",
            lineHeight: 1.4,
            resize: "none",
            background: !currentUser ? "#f6f6f6" : "white",
          }}
        />
      </div>

      <button
        type="button"
        disabled={saving || !authLoaded || !currentUser}
        onClick={() => save()}
        style={{
          marginTop: 14,
          padding: "9px 12px",
          borderRadius: 8,
          border: "1px solid #222",
          background: "black",
          color: "white",
          fontWeight: 700,
          cursor: saving || !currentUser ? "not-allowed" : "pointer",
          opacity: !currentUser ? 0.65 : 1,
        }}
      >
        {saving ? "Saving..." : "Save review/log"}
      </button>

      {message ? (
        <p style={{ color: "#555", marginBottom: 0 }}>{message}</p>
      ) : null}
    </section>
  );
}