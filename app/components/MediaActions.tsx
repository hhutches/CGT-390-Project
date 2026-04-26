"use client";

import { useState } from "react";

type MediaType = "MOVIE" | "SHOW" | "BOOK" | "ALBUM" | "GAME" | string;

type Props = {
  mediaId: string;
  mediaType: MediaType;
  existingEntry?: {
    id?: string;
    status?: string | null;
    rating?: number | null;
    review?: string | null;
  } | null;
};

function getCopy(type: MediaType) {
  if (type === "MOVIE") {
    return {
      wishlist: "Want to watch",
      progress: "Watching",
      done: "Watched",
      review: "Review movie",
      placeholder: "What did you think of this movie?",
    };
  }

  if (type === "SHOW") {
    return {
      wishlist: "Want to watch",
      progress: "Watching",
      done: "Watched",
      review: "Review show",
      placeholder: "What did you think of this show?",
    };
  }

  if (type === "BOOK") {
    return {
      wishlist: "Want to read",
      progress: "Reading",
      done: "Read",
      review: "Review book",
      placeholder: "What did you think of this book?",
    };
  }

  if (type === "ALBUM") {
    return {
      wishlist: "Want to listen",
      progress: "Listening",
      done: "Listened",
      review: "Review album",
      placeholder: "What did you think of this album?",
    };
  }

  if (type === "GAME") {
    return {
      wishlist: "Want to play",
      progress: "Playing",
      done: "Played",
      review: "Review game",
      placeholder: "What did you think of this game?",
    };
  }

  return {
    wishlist: "Want to check out",
    progress: "In progress",
    done: "Logged",
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

  async function saveEntry(nextStatus: string) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaId,
          status: nextStatus,
          rating,
          review: review.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save.");
      }

      setStatus(nextStatus);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-xl font-semibold">Add / Log / Review</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => saveEntry("WISHLIST")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            status === "WISHLIST"
              ? "bg-white text-black"
              : "bg-neutral-800 text-white hover:bg-neutral-700"
          }`}
        >
          {copy.wishlist}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveEntry("IN_PROGRESS")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            status === "IN_PROGRESS"
              ? "bg-white text-black"
              : "bg-neutral-800 text-white hover:bg-neutral-700"
          }`}
        >
          {copy.progress}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveEntry("COMPLETED")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            status === "COMPLETED"
              ? "bg-white text-black"
              : "bg-neutral-800 text-white hover:bg-neutral-700"
          }`}
        >
          {copy.done}
        </button>
      </div>

      <div className="mt-5">
        <label className="text-sm font-medium text-neutral-300">
          Rating: {rating ? `${rating}/5` : "—"}
        </label>

        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-2xl"
              aria-label={`${star} stars`}
            >
              {rating >= star ? "★" : "☆"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label className="text-sm font-medium text-neutral-300">
          {copy.review}
        </label>

        <textarea
          value={review}
          onChange={(event) => setReview(event.target.value)}
          placeholder={copy.placeholder}
          rows={4}
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-400"
        />
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => saveEntry(status || "COMPLETED")}
        className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save review/log"}
      </button>

      {message ? <p className="mt-3 text-sm text-neutral-400">{message}</p> : null}
    </section>
  );
}