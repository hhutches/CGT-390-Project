import { NextResponse } from "next/server";

type TmdbMovie = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
};

function tmdbImage(path: string | null | undefined) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

async function tmdbFetch(path: string) {
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  const url = new URL(`https://api.themoviedb.org/3/${path}`);

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  } else {
    throw new Error("TMDB_ACCESS_TOKEN or TMDB_API_KEY is missing.");
  }

  const response = await fetch(url.toString(), {
    headers,
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`TMDB popular request failed: ${response.status} ${body}`);
  }

  return response.json();
}

export async function GET() {
  try {
    const pages = await Promise.all([
      tmdbFetch("trending/movie/week?language=en-US&page=1"),
      tmdbFetch("trending/movie/week?language=en-US&page=2"),
    ]);

    const movies: TmdbMovie[] = pages.flatMap((page) =>
      Array.isArray(page?.results) ? page.results : []
    );

    const seen = new Set<number>();

    const popularMovies = movies
      .filter((movie) => movie.id && movie.title)
      .filter((movie) => {
        if (seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
      })
      .filter((movie) => (movie.vote_count ?? 0) >= 100)
      .slice(0, 40)
      .map((movie, index) => {
        const rating =
          typeof movie.vote_average === "number"
            ? Math.round(movie.vote_average)
            : null;

        return {
          id: movie.id,
          eventType: "POPULAR",
          bodyText: movie.overview || "Popular on TMDB this week.",
          ratingValue: rating,
          createdAt: new Date().toISOString(),
          entry: {
            id: movie.id,
            status: "POPULAR",
            reviewText: movie.overview || null,
            user: {
              id: "tmdb",
              username: "tmdb",
              displayName: "TMDB",
              avatarUrl: null,
            },
            media: {
              id: movie.id,
              provider: "TMDB",
              externalId: String(movie.id),
              type: "MOVIE",
              title: movie.title || movie.name || "Untitled",
              releaseDate: movie.release_date || null,
              coverUrl: tmdbImage(movie.poster_path),
              backdropUrl: tmdbImage(movie.backdrop_path),
              movieDetails: {
                runtimeMinutes: null,
              },
              showDetails: null,
              bookDetails: null,
              albumDetails: null,
              gameDetails: null,
              tmdbRank: index + 1,
              tmdbVoteAverage: movie.vote_average ?? null,
              tmdbVoteCount: movie.vote_count ?? null,
              tmdbPopularity: movie.popularity ?? null,
            },
          },
        };
      });

    return NextResponse.json(popularMovies);
  } catch (error) {
    console.error("TMDB popular this week error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load TMDB popular movies.",
      },
      { status: 500 }
    );
  }
}