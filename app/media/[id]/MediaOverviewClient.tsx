"use client";

import { useEffect, useRef, useState } from "react";
import MediaActions from "@/app/components/MediaActions";

type Person = {
  id: number | string;
  name: string;
  role: string;
  imageUrl: string | null;
};

type Extra = {
  trailer: {
    key: string;
    url: string;
    name: string;
  } | null;
  directors: Person[];
  cast: Person[];
};

type Media = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  releaseDate: string | Date | null;
  coverUrl: string | null;
  backdropUrl?: string | null;
};

function yearFromDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 4);
  }

  return String(date.getFullYear());
}

function typeLabel(type: string) {
  if (type === "MOVIE") return "Movie";
  if (type === "SHOW") return "Show";
  if (type === "BOOK") return "Book";
  if (type === "ALBUM") return "Album";
  if (type === "GAME") return "Game";
  return type;
}

function PeopleCarousel({
  title,
  people,
}: {
  title: string;
  people: Person[];
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  if (people.length === 0) return null;

  function scrollBy(amount: number) {
    rowRef.current?.scrollBy({
      left: amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-360)}
            className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => scrollBy(360)}
            className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]"
      >
        {people.map((person) => (
          <div
            key={`${person.id}-${person.role}`}
            className="w-32 shrink-0 rounded-2xl border border-neutral-800 bg-neutral-900 p-3"
          >
            <div className="h-36 w-full overflow-hidden rounded-xl bg-neutral-800">
              {person.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.imageUrl}
                  alt={person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                  No image
                </div>
              )}
            </div>

            <div className="mt-2 text-sm font-semibold">{person.name}</div>
            <div className="mt-1 line-clamp-2 text-xs text-neutral-400">
              {person.role}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MediaOverviewClient({
  media,
  existingEntry = null,
}: {
  media: Media;
  existingEntry?: {
    id?: string;
    status?: string | null;
    rating?: number | null;
    review?: string | null;
  } | null;
}) {
  const [extra, setExtra] = useState<Extra>({
    trailer: null,
    directors: [],
    cast: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadExtra() {
      if (media.type !== "MOVIE" && media.type !== "SHOW") return;

      try {
        const response = await fetch(`/api/media/${media.id}/tmdb-extra`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) return;

        if (!cancelled) {
          setExtra({
            trailer: data.trailer || null,
            directors: Array.isArray(data.directors) ? data.directors : [],
            cast: Array.isArray(data.cast) ? data.cast : [],
          });
        }
      } catch {
        // Keep page usable if trailer/cast fetch fails.
      }
    }

    loadExtra();

    return () => {
      cancelled = true;
    };
  }, [media.id, media.type]);

  const year = yearFromDate(media.releaseDate);

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <a href="/search" className="text-sm text-neutral-400 hover:text-white">
          ← Back to search
        </a>

        <section className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
              {media.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.coverUrl}
                  alt={`${media.title} poster`}
                  className="w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center text-neutral-500">
                  No image
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
                {typeLabel(media.type)}
              </p>

              <h1 className="mt-2 text-4xl font-semibold">
                {media.title}
                {year ? (
                  <span className="text-neutral-500"> ({year})</span>
                ) : null}
              </h1>

              <p className="mt-4 max-w-3xl text-neutral-300">
                {media.description || "No description available."}
              </p>
            </div>

            <div className="mt-6">
              <MediaActions
                mediaId={media.id}
                mediaType={media.type}
                existingEntry={existingEntry}
              />
            </div>

            {(media.type === "MOVIE" || media.type === "SHOW") ? (
              <>
                <section className="mt-8">
                  <h2 className="text-xl font-semibold">Trailer</h2>

                  {extra.trailer ? (
                    <div className="mt-3 aspect-video overflow-hidden rounded-2xl border border-neutral-800 bg-black">
                      <iframe
                        src={extra.trailer.url}
                        title={extra.trailer.name}
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-neutral-400">
                      No trailer available.
                    </p>
                  )}
                </section>

                <PeopleCarousel title="Director / Creator" people={extra.directors} />
                <PeopleCarousel title="Main cast" people={extra.cast} />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}