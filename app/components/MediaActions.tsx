"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const copy = getCopy(mediaType);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(existingEntry?.status || "");
  const [rating, setRating] = useState(existingEntry?.rating || 0);
  const [review, setReview] = useState(existingEntry?.review || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextStatus = status || "COMPLETED") {
    setSaving(true);
    setMessage("");

    try {
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
          mediaId: numericMediaId,
          status: nextStatus,
          ratingValue: rating || null,
          reviewText: review.trim() || null,
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please log in to add, rate, or review this.");
        }

        throw new Error(data?.error || data?.message || "Failed to save entry.");
      }

      setStatus(nextStatus);
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function StatusButton({ value, label }: { value: string; label: string }) {
    const active = status === value;

    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => save(value)}
        style={{
          padding: "5px 10px",
          borderRadius: 999,
          border: active ? "2px solid black" : "1px solid var(--app-border, #ccc)",
          background: active ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.74)",
          fontWeight: 800,
          fontSize: 12,
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
        marginTop: open ? 2 : 28,
        width: "100%",
        maxWidth: "none",
        display: "block",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          padding: open ? "7px 13px" : "7px 14px",
          borderRadius: 999,
          border: "1px solid #222",
          background: open ? "black" : "rgba(255,255,255,0.72)",
          color: open ? "white" : "black",
          fontWeight: 900,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {open ? "Close log" : "Add / rate / review"}
      </button>

      {open ? (
        <div
          style={{
            marginTop: 9,
            border: "1px solid var(--app-border, #ccc)",
            borderRadius: 16,
            padding: 12,
            background: "var(--app-surface-strong, rgba(255,255,255,0.9))",
            width: "100%",
            maxWidth: "none",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusButton value="WISHLIST" label={copy.wishlist} />

              {copy.inProgress ? (
                <StatusButton value="IN_PROGRESS" label={copy.inProgress} />
              ) : null}

              <StatusButton value="COMPLETED" label={copy.completed} />
            </div>

            <div
              style={{
                minWidth: 150,
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 12,
                  marginBottom: 6,
                }}
              >
                {rating ? `${rating}/10` : "No rating"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 5,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Rate ${value} out of 10`}
                    title={`${value}/10`}
                    disabled={saving}
                    onClick={() => setRating(value)}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 999,
                      border:
                        rating === value
                          ? "2px solid black"
                          : "1px solid var(--app-border, #ccc)",
                      background:
                        rating >= value ? "black" : "rgba(255,255,255,0.82)",
                      cursor: saving ? "not-allowed" : "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label
              htmlFor="review-text"
              style={{
                display: "block",
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {copy.review}
            </label>

            <textarea
              id="review-text"
              value={review}
              onChange={(event) => setReview(event.target.value)}
              rows={2}
              disabled={saving}
              placeholder={copy.placeholder}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                padding: 9,
                borderRadius: 12,
                border: "1px solid var(--app-border, #ccc)",
                font: "inherit",
                fontSize: 14,
                lineHeight: 1.3,
                resize: "vertical",
                minHeight: 58,
                background: saving ? "#f6f6f6" : "rgba(255,255,255,0.76)",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 9,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: "1px solid #222",
                background: "black",
                color: "white",
                fontWeight: 900,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>

            {rating ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setRating(0)}
                style={{
                  padding: "5px 9px",
                  borderRadius: 999,
                  border: "1px solid var(--app-border, #ccc)",
                  background: "rgba(255,255,255,0.72)",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Clear rating
              </button>
            ) : null}
          </div>

          {message ? (
            <p style={{ color: "#555", marginBottom: 0, fontSize: 13 }}>
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
