import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

async function tmdbFetch<T>(path: string) {
  const token = process.env.TMDB_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_ACCESS_TOKEN is missing.");
  }

  const response = await fetch(`https://api.themoviedb.org/3/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`TMDB failed: ${response.status}${body ? ` - ${body}` : ""}`);
  }

  return response.json() as Promise<T>;
}

function image(path: string | null | undefined, size = "w185") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const mediaId = Number(id);

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json({ error: "Invalid media id." }, { status: 400 });
    }

    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
      include: {
        externalRefs: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    if (media.type !== "MOVIE" && media.type !== "SHOW") {
      return NextResponse.json({
        trailer: null,
        directors: [],
        cast: [],
      });
    }

    const tmdbRef = media.externalRefs.find((ref) => {
      const provider = String(ref.provider).toUpperCase();
      return provider === "TMDB";
    });

    if (!tmdbRef?.externalId) {
      return NextResponse.json({
        trailer: null,
        directors: [],
        cast: [],
      });
    }

    const tmdbId = tmdbRef.externalId;
    const kind = media.type === "SHOW" ? "tv" : "movie";

    const [videos, credits] = await Promise.all([
      tmdbFetch<{
        results?: Array<{
          key?: string;
          site?: string;
          type?: string;
          official?: boolean;
          name?: string;
        }>;
      }>(`${kind}/${tmdbId}/videos?language=en-US`),

      tmdbFetch<{
        cast?: Array<{
          id: number;
          name: string;
          character?: string;
          profile_path?: string | null;
          order?: number;
        }>;
        crew?: Array<{
          id: number;
          name: string;
          job?: string;
          department?: string;
          profile_path?: string | null;
        }>;
      }>(`${kind}/${tmdbId}/credits?language=en-US`),
    ]);

    const trailer =
      videos.results?.find(
        (video) =>
          video.site === "YouTube" &&
          video.type === "Trailer" &&
          video.official
      ) ||
      videos.results?.find(
        (video) => video.site === "YouTube" && video.type === "Trailer"
      ) ||
      videos.results?.find((video) => video.site === "YouTube") ||
      null;

    const directors = (credits.crew || [])
      .filter((person) => {
        const job = (person.job || "").toLowerCase();
        const department = (person.department || "").toLowerCase();

        return (
          job === "director" ||
          job === "creator" ||
          department === "directing"
        );
      })
      .map((person) => ({
        id: person.id,
        name: person.name,
        role: person.job || "Director",
        imageUrl: image(person.profile_path),
      }));

    const cast = (credits.cast || [])
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, 18)
      .map((person) => ({
        id: person.id,
        name: person.name,
        role: person.character || "Cast",
        imageUrl: image(person.profile_path),
      }));

    return NextResponse.json({
      trailer: trailer?.key
        ? {
            key: trailer.key,
            url: `https://www.youtube.com/embed/${trailer.key}`,
            name: trailer.name || "Trailer",
          }
        : null,
      directors,
      cast,
    });
  } catch (error) {
    console.error("TMDB extra error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load TMDB extras.",
      },
      { status: 500 }
    );
  }
}
