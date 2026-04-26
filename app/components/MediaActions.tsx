"use client";

import { useState } from "react";

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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

export default function MediaActions({
  mediaId,
  mediaType,
  existingEntry = null,
}: Props) {
  const copy = getCopy(mediaType);

  const [status, setStatus] = useState(existingEntry?.status || "");
  const [rating, setRating] = useState(existingEntry?.rating || 0);
  const [review, setReview] = useState(existingEntry?.review || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextStatus = status || "COMPLETED") {
    setSaving(true);
    setMessage("");

    try {
      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const meData = await safeJson(meResponse);
      const userId = String(meData?.user?.id || "");

      if (!userId) {
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
          userId,
          mediaId: numericMediaId,
          status: nextStatus,
          ratingValue: rating || null,
          reviewText: review.trim() || null,
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save entry.");
      }

      setStatus(nextStatus);
      setMessage("Saved.");

      window.location.reload();
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
        disabled={saving}
        onClick={() => save(value)}
        style={{
          padding: "9px 12px",
          borderRadius: 8,
          border: active ? "2px solid black" : "1px solid #ccc",
          background: active ? "#f0f0f0" : "white",
          fontWeight: active ? 700 : 500,
          cursor: saving ? "not-allowed" : "pointer",
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatusButton value="WISHLIST" label={copy.wishlist} />

        {copy.inProgress ? (
          <StatusButton value="IN_PROGRESS" label={copy.inProgress} />
        ) : null}

        <StatusButton value="COMPLETED" label={copy.completed} />
      </div>

      <div style={{ marginTop: 18 }}>
        <label
          
          style={{
            display: "block",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Rating: {rating ? `${rating}/10` : "No rating"}
        </label>
<div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: rating === value ? "2px solid black" : "1px solid #ccc",
                background: rating === value ? "#f0f0f0" : "white",
                fontWeight: rating === value ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          ))}
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
          placeholder={copy.placeholder}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            font: "inherit",
            lineHeight: 1.45,
            resize: "none",
            background: "white",
          }}
        />
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => save()}
        style={{
          marginTop: 14,
          padding: "9px 12px",
          borderRadius: 8,
          border: "1px solid #222",
          background: "black",
          color: "white",
          fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
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