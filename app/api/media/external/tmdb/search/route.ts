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

type ScoredTmdbResult = TmdbResult & {
  _creditScore?: number;
  _creditReason?: string;
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
    let body = "";

    try {
      body = await response.text();
    } catch {
      body = "";
    }

    throw new Error(
      `TMDB request failed with status ${response.status}${
        body ? `: ${body}` : ""
      }.`
    );
  }

  return response.json() as Promise<T>;
}

function getReleaseYear(item: TmdbResult) {
  const date = item.release_date || item.first_air_date || "";
  const year = Number(date.slice(0, 4));

  return Number.isNaN(year) ? null : year;
}

function getBasePopularityScore(item: TmdbResult) {
  const popularity = item.popularity ?? 0;
  const voteCount = item.vote_count ?? 0;
  const voteAverage = item.vote_average ?? 0;

  let score = 0;

  score += popularity * 3;
  score += Math.min(voteCount, 20000) / 12;

  if (voteCount >= 1000) score += 500;
  if (voteCount >= 3000) score += 700;
  if (voteCount >= 8000) score += 900;

  if (voteAverage >= 7 && voteCount >= 500) score += 150;
  if (voteAverage >= 8 && voteCount >= 1000) score += 250;

  const year = getReleaseYear(item);

  if (year) {
    if (year > 2028) score -= 500;
    if (year >= 1960 && year <= 2028) score += 50;
  }

  return score;
}

function getLowValueAppearancePenalty(item: TmdbResult) {
  const title = normalizeText(item.title || item.name);
  const overview = normalizeText(item.overview);
  const text = `${title} ${overview}`;

  let penalty = 0;

  if (text.includes("talk show")) penalty -= 1600;
  if (text.includes("late night")) penalty -= 1500;
  if (text.includes("variety show")) penalty -= 1200;
  if (text.includes("reality")) penalty -= 1000;
  if (text.includes("celebrity")) penalty -= 800;
  if (text.includes("sketch comedy")) penalty -= 650;
  if (text.includes("interview")) penalty -= 600;
  if (text.includes("documentary")) penalty -= 400;
  if (title.includes("with ")) penalty -= 100;

  return penalty;
}

function getCrewCreditScore(job?: string, department?: string) {
  const normalizedJob = normalizeText(job);
  const normalizedDepartment = normalizeText(department);

  if (normalizedJob === "director") return 3200;
  if (normalizedJob === "creator") return 3100;
  if (normalizedJob === "screenplay") return 2600;
  if (normalizedJob === "writer") return 2500;
  if (normalizedJob === "story") return 1900;
  if (normalizedJob === "characters") return 1200;
  if (normalizedJob === "executive producer") return 1000;

  if (normalizedDepartment === "directing") return 2200;
  if (normalizedDepartment === "writing") return 2100;

  // Do not score generic production crew. Otherwise unrelated people with the
  // same name can pull in false positives like production-assistant credits.
  return 0;
}

function getCastCreditScore(order?: number) {
  if (order === undefined || order === null) return 500;
  if (order <= 0) return 1600;
  if (order <= 2) return 1300;
  if (order <= 5) return 950;
  if (order <= 10) return 600;

  return 250;
}

function mergeScoredWorks(items: ScoredTmdbResult[]) {
  const byKey = new Map<string, ScoredTmdbResult>();

  for (const item of items) {
    const kind = item.media_type;
    if (kind !== "movie" && kind !== "tv") continue;

    const key = `${kind}:${item.id}`;
    const existing = byKey.get(key);

    if (!existing || (item._creditScore ?? 0) > (existing._creditScore ?? 0)) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values());
}

function toMediaResult(item: ScoredTmdbResult, type: TmdbSearchType) {
  const imageBase = getImageBase();
  const kind = getKind(item, type);
  const isMovie = kind === "movie";

  if (kind !== "movie" && kind !== "tv") {
    return null;
  }

  return {
    provider: "TMDB",
    externalId: String(item.id),
    type: isMovie ? "MOVIE" : "SHOW",
    title: isMovie
      ? item.title ?? "Untitled Movie"
      : item.name ?? "Untitled Show",
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
    creditScore: item._creditScore ?? 0,
    creditReason: item._creditReason ?? null,
    raw: item,
  };
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
    .map((item) => ({
      ...item,
      _creditScore: 0,
      _creditReason: "title",
    }))
    .map((item) => toMediaResult(item, type))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aScore =
        (a.popularity ?? 0) * 3 +
        Math.min(a.voteCount ?? 0, 20000) / 12 +
        (a.voteAverage ?? 0) * 20;
      const bScore =
        (b.popularity ?? 0) * 3 +
        Math.min(b.voteCount ?? 0, 20000) / 12 +
        (b.voteAverage ?? 0) * 20;

      return bScore - aScore;
    });
}

function selectBestPeopleForQuery(
  people: TmdbPersonResult[],
  query: string
): TmdbPersonResult[] {
  const queryNormalized = normalizeText(query);

  const exactPeople = people
    .filter((person) => person.id)
    .filter((person) => normalizeText(person.name) === queryNormalized)
    .sort((a, b) => {
      const aDepartment = normalizeText(a.known_for_department);
      const bDepartment = normalizeText(b.known_for_department);

      const aDepartmentBoost =
        aDepartment === "directing" || aDepartment === "acting" ? 1000 : 0;
      const bDepartmentBoost =
        bDepartment === "directing" || bDepartment === "acting" ? 1000 : 0;

      return (
        (b.popularity ?? 0) +
        bDepartmentBoost -
        ((a.popularity ?? 0) + aDepartmentBoost)
      );
    });

  const fallbackPeople = people
    .filter((person) => person.id)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

  return exactPeople.length > 0
    ? exactPeople.slice(0, 1)
    : fallbackPeople.slice(0, 1);
}

async function searchByPerson(q: string, type: TmdbSearchType) {
  const personData = await tmdbFetch<TmdbPersonSearchResponse>("search/person", {
    query: q.trim(),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });

  const people = selectBestPeopleForQuery(personData.results ?? [], q);
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

    for (const item of cast) {
      const kind = item.media_type;

      if (kind !== "movie" && kind !== "tv") continue;

      allWorks.push({
        ...item,
        _creditScore: getCastCreditScore(item.order),
        _creditReason: item.character ? `cast: ${item.character}` : "cast",
      });
    }

    for (const item of crew) {
      const kind = item.media_type;

      if (kind !== "movie" && kind !== "tv") continue;

      const creditScore = getCrewCreditScore(item.job, item.department);

      if (creditScore <= 0) continue;

      allWorks.push({
        ...item,
        _creditScore: creditScore,
        _creditReason: item.job || item.department || "crew",
      });
    }
  }

  const wantedKind = type === "movie" ? "movie" : type === "tv" ? "tv" : null;

  return mergeScoredWorks(allWorks)
    .filter((item) => {
      const kind = item.media_type;

      if (kind !== "movie" && kind !== "tv") return false;
      if (wantedKind && kind !== wantedKind) return false;

      return true;
    })
    .map((item) => toMediaResult(item, item.media_type ?? type))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aRaw = a.raw as ScoredTmdbResult;
      const bRaw = b.raw as ScoredTmdbResult;

      const aScore =
        (aRaw._creditScore ?? 0) +
        getBasePopularityScore(aRaw) +
        getLowValueAppearancePenalty(aRaw);

      const bScore =
        (bRaw._creditScore ?? 0) +
        getBasePopularityScore(bRaw) +
        getLowValueAppearancePenalty(bRaw);

      return bScore - aScore;
    })
    .slice(0, 30);
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