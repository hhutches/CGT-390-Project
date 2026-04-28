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
          padding: "4px 9px",
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
      className="media-actions-root"
      style={{
        marginTop: 0,
        width: "100%",
        maxWidth: "none",
        height: "100%",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          padding: "7px 13px",
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
          className="media-actions-panel"
          style={{
            marginTop: 8,
            border: "1px solid var(--app-border, #ccc)",
            borderRadius: 16,
            padding: 12,
            background: "var(--app-surface-strong, rgba(255,255,255,0.9))",
            width: "100%",
            maxWidth: "none",
            height: "calc(100% - 44px)",
            minHeight: 0,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 300px",
              gap: 18,
              alignItems: "stretch",
              height: "100%",
              minHeight: 0,
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",              }}
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
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <label
                  htmlFor="review-text"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    fontSize: 12,
                    marginBottom: 5,
                  }}
                >
                  {copy.review}
                </label>

                <textarea
                  id="review-text"
                  value={review}
                  onChange={(event) => setReview(event.target.value)}
                  rows={4}
                  disabled={saving}
                  placeholder={copy.placeholder}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid var(--app-border, #ccc)",
                    font: "inherit",
                    fontSize: 13,
                    lineHeight: 1.25,
                    resize: "vertical",
                    minHeight: 0,
                    maxHeight: "none",
                    flex: 1,
                    background: saving ? "#f6f6f6" : "rgba(255,255,255,0.76)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 10,
                height: "100%",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <strong style={{ fontSize: 12 }}>
                  Rating:
                </strong>

                <div
                  style={{
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
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

              {rating ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setRating(0)}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: "underline",
                  }}
                >
                  Clear rating
                </button>
              ) : null}

              <button
                className="media-actions-save"
                type="button"
                disabled={saving}
                onClick={() => save()}
                style={{
                  padding: "8px 14px",
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
            </div>
          </div>

          {message ? (
            <p style={{ color: "#555", margin: "8px 0 0", fontSize: 12 }}>
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
