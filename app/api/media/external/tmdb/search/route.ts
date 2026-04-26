import { NextResponse } from "next/server";

type TmdbSearchType = "movie" | "tv" | "multi";
type SearchBy = "title" | "person";

type TmdbResult = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  original_language?: string;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  video?: boolean;
};

type ScoredTmdbResult = TmdbResult & {
  _creditScore?: number;
  _creditReason?: string;
};

type TmdbPersonResult = {
  id: number;
  name?: string;
  known_for_department?: string;
  popularity?: number;
  known_for?: TmdbResult[];
};

type TmdbPersonSearchResponse = {
  results?: TmdbPersonResult[];
};

type TmdbSearchResponse = {
  results?: TmdbResult[];
};

type TmdbCreditsResponse = {
  cast?: Array<
    TmdbResult & {
      character?: string;
      order?: number;
    }
  >;
  crew?: Array<
    TmdbResult & {
      job?: string;
      department?: string;
    }
  >;
};

function normalizeSearchType(value: string | null): TmdbSearchType {
  if (value === "movie" || value === "tv" || value === "multi") {
    return value;
  }

  return "multi";
}

function normalizeSearchBy(value: string | null): SearchBy {
  if (value === "person") return "person";
  return "title";
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getEndpoint(type: TmdbSearchType) {
  if (type === "movie") return "search/movie";
  if (type === "tv") return "search/tv";
  return "search/multi";
}

function getKind(item: TmdbResult, type: TmdbSearchType) {
  return item.media_type ?? type;
}

function getImageBase() {
  return process.env.TMDB_IMAGE_BASE_URL ?? "https://image.tmdb.org/t/p/w500";
}

async function tmdbFetch<T>(path: string, params: Record<string, string>) {
  const token = process.env.TMDB_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_ACCESS_TOKEN is missing.");
  }

  const url = new URL(`https://api.themoviedb.org/3/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `TMDB request failed with status ${response.status}${
        body ? ` - ${body}` : ""
      }`
    );
  }

  return response.json() as Promise<T>;
}

function getCrewCreditScore(item: { job?: string; department?: string }) {
  const job = normalizeText(item.job);
  const department = normalizeText(item.department);

  if (job === "director") return { score: 2600, reason: "Director" };
  if (job === "creator") return { score: 2600, reason: "Creator" };
  if (job === "writer") return { score: 2300, reason: "Writer" };
  if (job === "screenplay") return { score: 2300, reason: "Screenplay" };
  if (job === "story") return { score: 2100, reason: "Story" };
  if (job === "characters") return { score: 1900, reason: "Characters" };

  if (department === "directing") {
    return { score: 1800, reason: item.job || "Directing" };
  }

  if (department === "writing") {
    return { score: 1700, reason: item.job || "Writing" };
  }

  if (department === "production") {
    return { score: 500, reason: item.job || "Production" };
  }

  return { score: 300, reason: item.job || item.department || "Crew" };
}

function getCastCreditScore(item: { character?: string; order?: number }) {
  const order = item.order ?? 999;
  const character = item.character?.trim();

  if (order <= 2) {
    return {
      score: 1400,
      reason: character ? `Cast: ${character}` : "Cast",
    };
  }

  if (order <= 8) {
    return {
      score: 1100,
      reason: character ? `Cast: ${character}` : "Cast",
    };
  }

  return {
    score: 700,
    reason: character ? `Cast: ${character}` : "Cast",
  };
}

function isUsefulCrewCredit(item: { job?: string; department?: string }) {
  const job = normalizeText(item.job);
  const department = normalizeText(item.department);

  return (
    job === "director" ||
    job === "creator" ||
    job === "screenplay" ||
    job === "writer" ||
    job === "story" ||
    job === "characters" ||
    department === "directing" ||
    department === "writing"
  );
}

function shouldDropLowValuePersonCredit(item: ScoredTmdbResult) {
  const creditReason = normalizeText(item._creditReason);
  const voteCount = item.vote_count ?? 0;
  const popularity = item.popularity ?? 0;
  const title = normalizeText(item.title || item.name);
  const overview = normalizeText(item.overview);

  if (creditReason.includes("cast: self")) return true;
  if (creditReason.includes("archive footage")) return true;

  if (overview.includes("talk show")) return true;
  if (overview.includes("late night")) return true;
  if (overview.includes("reality")) return true;
  if (overview.includes("variety show")) return true;

  if (title.includes("late night")) return true;
  if (title.includes("jimmy kimmel")) return true;
  if (title.includes("ellen degeneres")) return true;

  const isMinorCast =
    creditReason.includes("cast:") && (item._creditScore ?? 0) < 900;

  if (isMinorCast && voteCount < 500 && popularity < 5) return true;

  return false;
}

function toMediaResult(item: TmdbResult, type: TmdbSearchType) {
  const imageBase = getImageBase();
  const kind = getKind(item, type);
  const isMovie = kind === "movie";

  if (kind !== "movie" && kind !== "tv") {
    return null;
  }

  const scoredItem = item as ScoredTmdbResult;

  return {
    provider: "TMDB",
    externalId: String(item.id),
    type: isMovie ? "MOVIE" : "SHOW",
    title: isMovie ? item.title ?? "Untitled Movie" : item.name ?? "Untitled Show",
    description: item.overview ?? null,
    releaseDate: isMovie
      ? item.release_date ?? null
      : item.first_air_date ?? null,
    coverUrl: item.poster_path ? `${imageBase}${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${imageBase}${item.backdrop_path}` : null,
    languageCode: item.original_language ?? null,
    popularity: item.popularity ?? 0,
    voteCount: item.vote_count ?? 0,
    voteAverage: item.vote_average ?? 0,
    creditScore: scoredItem._creditScore ?? 0,
    creditReason: scoredItem._creditReason ?? null,
    raw: item,
  };
}

function scoreTitleResult(item: TmdbResult, query: string) {
  const q = normalizeText(query);
  const title = normalizeText(item.title || item.name);
  const voteCount = item.vote_count ?? 0;
  const popularity = item.popularity ?? 0;
  const voteAverage = item.vote_average ?? 0;

  let score = 0;

  if (title === q) score += 3000;
  else if (title.startsWith(q)) score += 1200;
  else if (title.includes(q)) score += 700;

  score += Math.log10(voteCount + 1) * 420;
  score += Math.log10(popularity + 1) * 180;

  if (voteAverage >= 7 && voteCount >= 500) score += 120;
  if (voteAverage >= 8 && voteCount >= 1000) score += 180;
  if (voteCount >= 1000) score += 300;
  if (voteCount >= 3000) score += 350;
  if (voteCount >= 8000) score += 450;

  if (item.video) score -= 700;

  return score;
}

function scorePersonWork(item: ScoredTmdbResult) {
  const voteCount = item.vote_count ?? 0;
  const popularity = item.popularity ?? 0;
  const voteAverage = item.vote_average ?? 0;
  const creditScore = item._creditScore ?? 0;

  let score = creditScore;

  score += Math.log10(voteCount + 1) * 420;
  score += Math.log10(popularity + 1) * 180;

  if (voteAverage >= 7 && voteCount >= 500) score += 120;
  if (voteAverage >= 8 && voteCount >= 1000) score += 180;
  if (voteCount >= 1000) score += 300;
  if (voteCount >= 3000) score += 350;
  if (voteCount >= 8000) score += 450;

  if (item.video) score -= 600;

  if (shouldDropLowValuePersonCredit(item)) {
    score -= 5000;
  }

  return score;
}

async function searchByTitle(q: string, type: TmdbSearchType) {
  const data = await tmdbFetch<TmdbSearchResponse>(getEndpoint(type), {
    query: q.trim(),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });

  return (data.results ?? [])
    .filter((item) => {
      const kind = getKind(item, type);
      return kind === "movie" || kind === "tv";
    })
    .map((item) => toMediaResult(item, type))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aRaw = a.raw as TmdbResult;
      const bRaw = b.raw as TmdbResult;

      return scoreTitleResult(bRaw, q) - scoreTitleResult(aRaw, q);
    });
}

async function searchByPerson(q: string, type: TmdbSearchType) {
  const personData = await tmdbFetch<TmdbPersonSearchResponse>("search/person", {
    query: q.trim(),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });

  const people = (personData.results ?? [])
    .filter((person) => person.id)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 3);

  const allWorks: ScoredTmdbResult[] = [];

  for (const person of people) {
    const credits = await tmdbFetch<TmdbCreditsResponse>(
      `person/${person.id}/combined_credits`,
      {
        language: "en-US",
      }
    );

    const cast = credits.cast ?? [];
    const crew = credits.crew ?? [];

    for (const item of crew) {
      if (!item.id) continue;

      const kind = item.media_type;
      if (kind !== "movie" && kind !== "tv") continue;

      if (!isUsefulCrewCredit(item)) continue;

      const credit = getCrewCreditScore(item);

      allWorks.push({
        ...item,
        _creditScore: credit.score,
        _creditReason: credit.reason,
      });
    }

    for (const item of cast) {
      if (!item.id) continue;

      const kind = item.media_type;
      if (kind !== "movie" && kind !== "tv") continue;

      const credit = getCastCreditScore(item);

      allWorks.push({
        ...item,
        _creditScore: credit.score,
        _creditReason: credit.reason,
      });
    }
  }

  const wantedKind = type === "movie" ? "movie" : type === "tv" ? "tv" : null;
  const bestByKey = new Map<string, ScoredTmdbResult>();

  for (const item of allWorks) {
    const kind = item.media_type;

    if (kind !== "movie" && kind !== "tv") continue;
    if (wantedKind && kind !== wantedKind) continue;

    const key = `${kind}:${item.id}`;
    const existing = bestByKey.get(key);

    if (!existing || scorePersonWork(item) > scorePersonWork(existing)) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()]
    .filter((item) => !shouldDropLowValuePersonCredit(item))
    .map((item) => {
      const mediaType: TmdbSearchType =
        item.media_type === "movie" || item.media_type === "tv"
          ? item.media_type
          : type;

      return toMediaResult(item, mediaType);
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aRaw = a.raw as ScoredTmdbResult;
      const bRaw = b.raw as ScoredTmdbResult;

      return scorePersonWork(bRaw) - scorePersonWork(aRaw);
    })
    .slice(0, 25);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q") ?? "";
    const type = normalizeSearchType(searchParams.get("type"));
    const searchBy = normalizeSearchBy(searchParams.get("searchBy"));

    if (!q.trim()) {
      return NextResponse.json(
        { error: "Search query is required." },
        { status: 400 }
      );
    }

    if (!process.env.TMDB_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "TMDB_ACCESS_TOKEN is missing." },
        { status: 500 }
      );
    }

    const results =
      searchBy === "person"
        ? await searchByPerson(q, type)
        : await searchByTitle(q, type);

    return NextResponse.json(results);
  } catch (error) {
    console.error("TMDB search error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TMDB search failed.",
      },
      { status: 500 }
    );
  }
}