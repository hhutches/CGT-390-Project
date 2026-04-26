import { NextRequest, NextResponse } from "next/server";

type RawgGame = {
  id: number;
  slug?: string;
  name?: string;
  released?: string | null;
  background_image?: string | null;
  rating?: number | null;
  ratings_count?: number | null;
  metacritic?: number | null;
  added?: number | null;
  playtime?: number | null;
  platforms?: Array<{
    platform?: {
      id?: number;
      name?: string;
      slug?: string;
    };
  }>;
  genres?: Array<{
    id?: number;
    name?: string;
    slug?: string;
  }>;
  stores?: Array<{
    store?: {
      id?: number;
      name?: string;
      slug?: string;
    };
  }>;
};

type RawgSearchResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: RawgGame[];
};

function getRawgExternalUrl(game: RawgGame) {
  if (game.slug) {
    return `https://rawg.io/games/${game.slug}`;
  }

  return `https://rawg.io/games/${game.id}`;
}

function getPlatformNames(game: RawgGame) {
  return (game.platforms ?? [])
    .map((item) => item.platform?.name)
    .filter((name): name is string => Boolean(name));
}

function getGenreNames(game: RawgGame) {
  return (game.genres ?? [])
    .map((genre) => genre.name)
    .filter((name): name is string => Boolean(name));
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing RAWG_API_KEY." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 }
      );
    }

    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("search", query);
    url.searchParams.set("page_size", "10");
    url.searchParams.set("search_precise", "true");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let rawgResponse: unknown = null;

      try {
        rawgResponse = await response.json();
      } catch {
        rawgResponse = await response.text().catch(() => null);
      }

      return NextResponse.json(
        {
          error: "RAWG search failed.",
          status: response.status,
          rawgResponse,
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as RawgSearchResponse;

    const results = (data.results ?? []).map((game) => ({
      provider: "RAWG",
      externalId: String(game.id),
      type: "GAME",
      title: game.name ?? "Untitled Game",
      description: null,
      releaseDate: game.released ?? null,
      coverUrl: game.background_image ?? null,
      backdropUrl: game.background_image ?? null,
      languageCode: null,
      externalUrl: getRawgExternalUrl(game),
      platforms: getPlatformNames(game),
      genres: getGenreNames(game),
      rating: game.rating ?? null,
      ratingsCount: game.ratings_count ?? null,
      metacritic: game.metacritic ?? null,
      added: game.added ?? null,
      playtime: game.playtime ?? null,
      raw: game,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("RAWG search error:", error);

    return NextResponse.json(
      {
        error: "Internal RAWG search error.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}