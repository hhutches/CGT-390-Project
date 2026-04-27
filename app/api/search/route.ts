import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  getBestSpotifyImage,
  getSpotifyArtistAlbums,
  searchSpotifyAlbums,
  searchSpotifyArtists,
  type SpotifyAlbum,
  type SpotifyArtist,
} from "@/lib/spotify";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  source: string;
  href: string;
  coverUrl: string | null;
  provider?: string | null;
  externalId?: string | null;
  rank: number;
};

type QueryProfile = {
  likelyMusicArtist: boolean;
  likelyFilmTvPerson: boolean;
  likelyAuthor: boolean;
  likelyGameQuery: boolean;
  likelyTitleQuery: boolean;
};

type SpotifyAlbumResult = {
  provider: "SPOTIFY";
  externalId: string;
  type: "ALBUM";
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  artists?: string[];
  primaryArtistName?: string | null;
  totalTracks?: number | null;
  albumType?: string | null;
  spotifyPopularity?: number | null;
  spotifyArtistFollowers?: number | null;
};

type TmdbMediaResult = {
  provider: "TMDB";
  externalId: string;
  type: "MOVIE" | "SHOW";
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  languageCode: string | null;
  popularity?: number;
  voteCount?: number;
  voteAverage?: number;
  creditScore?: number;
  creditReason?: string | null;
};

type CombinedTmdbMediaResult = TmdbMediaResult & {
  _combinedTitlePart?: string;
  _combinedPersonPart?: string;
  _combinedMatchKind?: "exact" | "person-context" | "title-context";
};

type GoogleBookResult = {
  provider: "GOOGLE_BOOKS";
  externalId: string;
  type: "BOOK";
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  authors?: string[];
  pageCount?: number | null;
  averageRating?: number | null;
  ratingsCount?: number | null;
  isbn13?: string | null;
};

type CombinedGoogleBookResult = GoogleBookResult & {
  _combinedTitlePart?: string;
  _combinedCreatorPart?: string;
};

type RawgGameResult = {
  provider: "RAWG";
  externalId: string;
  type: "GAME";
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  platforms?: string[];
  genres?: string[];
  rating?: number | null;
  ratingsCount?: number | null;
  metacritic?: number | null;
  added?: number | null;
  playtime?: number | null;
};

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

function yearFromDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 4);
  }

  return String(date.getFullYear());
}

function mediaSubtitle(media: {
  type: string;
  releaseDate: Date | null;
  description: string | null;
}) {
  const parts: string[] = [media.type];

  const year = yearFromDate(media.releaseDate);
  if (year) parts.push(year);

  if (media.description) {
    parts.push(media.description.slice(0, 120));
  }

  return parts.join(" · ");
}

function getBaseUrl(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host");

  if (!host) {
    throw new Error("Missing request host.");
  }

  return `${protocol}://${host}`;
}

async function fetchJsonArray<T>(
  request: NextRequest,
  url: URL,
  resultKey?: string
) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const authorization = request.headers.get("authorization") || "";

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Search subrequest failed:", url.toString(), res.status, body);
      return [];
    }

    const data = await res.json();

    if (resultKey) {
      return Array.isArray(data?.[resultKey]) ? (data[resultKey] as T[]) : [];
    }

    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.error("Search subrequest crashed:", url.toString(), error);
    return [];
  }
}

function importHref(provider: string, externalId: string, type: string) {
  return `/media/import?provider=${encodeURIComponent(
    provider
  )}&externalId=${encodeURIComponent(externalId)}&type=${encodeURIComponent(
    type
  )}`;
}

function spotifyAlbumKey(album: SpotifyAlbum) {
  return normalizeText(
    `${album.name}:${album.artists.map((artist) => artist.name).join(",")}`
  );
}

function getSpotifyArtistScore(query: string, artist: SpotifyArtist) {
  const q = normalizeText(query);
  const name = normalizeText(artist.name);

  let score = artist.popularity ?? 0;

  score += Math.log10((artist.followers?.total ?? 0) + 1) * 12;

  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 300;
  else if (name.includes(q)) score += 120;

  return score;
}

function toSpotifyAlbumResult(
  album: SpotifyAlbum,
  searchedArtist?: SpotifyArtist
): SpotifyAlbumResult {
  const primaryArtist = album.artists[0];

  return {
    provider: "SPOTIFY",
    externalId: album.id,
    type: "ALBUM",
    title: album.name,
    description: primaryArtist
      ? `Album by ${album.artists.map((artist) => artist.name).join(", ")}`
      : null,
    releaseDate: album.release_date || null,
    coverUrl: getBestSpotifyImage(album.images),
    artists: album.artists.map((artist) => artist.name),
    primaryArtistName: primaryArtist?.name ?? null,
    totalTracks: album.total_tracks ?? null,
    albumType: album.album_type,
    spotifyPopularity: searchedArtist?.popularity ?? null,
    spotifyArtistFollowers: searchedArtist?.followers?.total ?? null,
  };
}

async function fetchSpotifyAlbums(query: string, searchBy: "artist" | "album") {
  try {
    if (searchBy === "album") {
      const albums = await searchSpotifyAlbums(query);
      const seen = new Set<string>();

      return albums
        .filter((album) => album.id && album.name)
        .filter((album) => {
          const key = spotifyAlbumKey(album);

          if (seen.has(key)) return false;

          seen.add(key);
          return true;
        })
        .map((album) => toSpotifyAlbumResult(album));
    }

    const artists = await searchSpotifyArtists(query);

    const bestArtist = artists
      .filter((artist) => artist.id && artist.name)
      .sort(
        (a, b) =>
          getSpotifyArtistScore(query, b) - getSpotifyArtistScore(query, a)
      )[0];

    if (!bestArtist) return [];

    const albums = await getSpotifyArtistAlbums(bestArtist.id);
    const seen = new Set<string>();

    return albums
      .filter((album) => album.id && album.name)
      .filter((album) => album.album_type === "album")
      .filter((album) => {
        const key = spotifyAlbumKey(album);

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .map((album) => toSpotifyAlbumResult(album, bestArtist));
  } catch (error) {
    console.error("Spotify universal search failed:", error);
    return [];
  }
}

async function fetchTmdbPersonWorks(
  request: NextRequest,
  query: string,
  type: "movie" | "tv"
) {
  const baseUrl = getBaseUrl(request);
  const url = new URL("/api/media/external/tmdb/search", baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("searchBy", "person");

  return fetchJsonArray<TmdbMediaResult>(request, url);
}

async function fetchTmdbTitleResults(
  request: NextRequest,
  query: string,
  type: "movie" | "tv"
) {
  const baseUrl = getBaseUrl(request);
  const url = new URL("/api/media/external/tmdb/search", baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("searchBy", "title");

  return fetchJsonArray<TmdbMediaResult>(request, url);
}

async function fetchGoogleBooks(
  request: NextRequest,
  query: string,
  searchBy: "title" | "author"
) {
  const baseUrl = getBaseUrl(request);
  const url = new URL("/api/media/external/books/search", baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("searchBy", searchBy);

  return fetchJsonArray<GoogleBookResult>(request, url, "results");
}

function getCombinedQueryParts(query: string) {
  const words = normalizeText(query).split(" ").filter(Boolean);

  if (words.length < 3) return [];

  const parts: Array<{ titlePart: string; creatorPart: string }> = [];

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const titlePart = words.slice(0, splitIndex).join(" ");
    const creatorPart = words.slice(splitIndex).join(" ");

    if (titlePart.length >= 2 && creatorPart.length >= 4) {
      parts.push({ titlePart, creatorPart });
    }
  }

  return parts;
}

async function fetchCombinedBookResults(request: NextRequest, query: string) {
  const parts = getCombinedQueryParts(query);

  if (parts.length === 0) return [];

  const allResults: CombinedGoogleBookResult[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const [titleResults, authorResults] = await Promise.all([
      fetchGoogleBooks(request, part.titlePart, "title"),
      fetchGoogleBooks(request, part.creatorPart, "author"),
    ]);

    const combinedMatches = [...titleResults, ...authorResults].filter(
      (item) => {
        const title = normalizeText(item.title);
        const authors = normalizeText((item.authors || []).join(" "));
        const titlePart = normalizeText(part.titlePart);
        const creatorPart = normalizeText(part.creatorPart);

        return title.includes(titlePart) && authors.includes(creatorPart);
      }
    );

    for (const item of combinedMatches) {
      const key = `${item.externalId}:${part.titlePart}:${part.creatorPart}`;

      if (seen.has(key)) continue;

      seen.add(key);

      allResults.push({
        ...item,
        _combinedTitlePart: part.titlePart,
        _combinedCreatorPart: part.creatorPart,
      });
    }
  }

  return allResults;
}

function getCombinedMediaQueryParts(query: string) {
  const words = normalizeText(query).split(" ").filter(Boolean);

  if (words.length < 3) return [];

  const parts: Array<{ titlePart: string; personPart: string }> = [];
  const seen = new Set<string>();

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const left = words.slice(0, splitIndex).join(" ");
    const right = words.slice(splitIndex).join(" ");

    const candidates = [
      { titlePart: left, personPart: right },
      { titlePart: right, personPart: left },
    ];

    for (const candidate of candidates) {
      if (candidate.titlePart.length < 2 || candidate.personPart.length < 4) {
        continue;
      }

      const key = `${candidate.titlePart}:${candidate.personPart}`;

      if (seen.has(key)) continue;

      seen.add(key);
      parts.push(candidate);
    }
  }

  return parts.slice(0, 8);
}

async function fetchCombinedTmdbResults(request: NextRequest, query: string) {
  const parts = getCombinedMediaQueryParts(query);

  if (parts.length === 0) return [];

  const results: CombinedTmdbMediaResult[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const [
      titleMovies,
      titleShows,
      personMovies,
      personShows,
    ] = await Promise.all([
      fetchTmdbTitleResults(request, part.titlePart, "movie"),
      fetchTmdbTitleResults(request, part.titlePart, "tv"),
      fetchTmdbPersonWorks(request, part.personPart, "movie"),
      fetchTmdbPersonWorks(request, part.personPart, "tv"),
    ]);

    const titleResults = [...titleMovies, ...titleShows];
    const personResults = [...personMovies, ...personShows];

    const personIds = new Set(
      personResults.map((item) => `${item.type}:${item.externalId}`)
    );

    const exactMatches = titleResults.filter((item) =>
      personIds.has(`${item.type}:${item.externalId}`)
    );

    if (exactMatches.length === 0) {
      continue;
    }

    for (const item of exactMatches) {
      const key = `exact:${item.type}:${item.externalId}:${part.titlePart}:${part.personPart}`;

      if (seen.has(key)) continue;

      seen.add(key);

      results.push({
        ...item,
        _combinedTitlePart: part.titlePart,
        _combinedPersonPart: part.personPart,
        _combinedMatchKind: "exact",
      });
    }

    for (const item of personResults.slice(0, 6)) {
      const key = `person:${item.type}:${item.externalId}:${part.personPart}`;

      if (seen.has(key)) continue;

      seen.add(key);

      results.push({
        ...item,
        _combinedTitlePart: part.titlePart,
        _combinedPersonPart: part.personPart,
        _combinedMatchKind: "person-context",
      });
    }

    for (const item of titleResults.slice(0, 6)) {
      const key = `title:${item.type}:${item.externalId}:${part.titlePart}`;

      if (seen.has(key)) continue;

      seen.add(key);

      results.push({
        ...item,
        _combinedTitlePart: part.titlePart,
        _combinedPersonPart: part.personPart,
        _combinedMatchKind: "title-context",
      });
    }

    break;
  }

  return results;
}

async function fetchRawgGames(request: NextRequest, query: string) {
  const baseUrl = getBaseUrl(request);
  const url = new URL("/api/media/external/rawg/search", baseUrl);

  url.searchParams.set("q", query);

  return fetchJsonArray<RawgGameResult>(request, url, "results");
}

function getQueryMatchScore({
  query,
  title,
  creators,
}: {
  query: string;
  title: string;
  creators?: string[];
}) {
  const q = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const creatorText = normalizeText((creators || []).join(" "));

  let score = 0;

  if (normalizedTitle === q) score += 1000;
  else if (normalizedTitle.startsWith(q)) score += 500;
  else if (normalizedTitle.includes(q)) score += 250;

  if (creatorText === q) score += 1400;
  else if (creatorText.includes(q)) score += 700;

  return score;
}

function isStrongQueryMatch({
  query,
  title,
  creators = [],
}: {
  query: string;
  title: string;
  creators?: string[];
}) {
  const q = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const normalizedCreators = creators.map((creator) => normalizeText(creator));
  const creatorText = normalizeText(creators.join(" "));

  if (!q) return false;

  if (normalizedTitle === q) return true;
  if (normalizedTitle.includes(q)) return true;
  if (normalizedCreators.some((creator) => creator === q)) return true;
  if (creatorText.includes(q)) return true;

  const words = q.split(" ").filter((word) => word.length > 2);

  if (words.length <= 1) {
    return normalizedTitle.includes(q) || creatorText.includes(q);
  }

  return words.every((word) => normalizedTitle.includes(word));
}

function isWeakSingleWordLeak(query: string, title: string) {
  const q = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const queryWords = q.split(" ").filter((word) => word.length > 2);

  if (queryWords.length <= 1) return false;

  const matchedWords = queryWords.filter((word) =>
    normalizedTitle.includes(word)
  );

  return matchedWords.length > 0 && matchedWords.length < queryWords.length;
}

function isSingleWordQuery(query: string) {
  return normalizeText(query).split(" ").filter(Boolean).length === 1;
}

function isExactTitle(itemTitle: string, query: string) {
  return normalizeText(itemTitle) === normalizeText(query);
}

function looksLikeTitleQuery(query: string) {
  const words = normalizeText(query).split(" ").filter(Boolean);
  const firstWord = words[0];

  return firstWord === "the" || firstWord === "a" || firstWord === "an";
}

function getRecencyScore(value: string | Date | null | undefined) {
  if (!value) return 0;

  const year =
    value instanceof Date
      ? value.getFullYear()
      : Number(String(value).slice(0, 4));

  if (Number.isNaN(year)) return 0;

  if (year > 2028) return -250;
  if (year >= 2020) return 40;
  if (year >= 1990) return 60;
  if (year >= 1960) return 40;

  return 0;
}

function logarithmicPopularity(
  value: number | null | undefined,
  multiplier: number
) {
  const safeValue = Math.max(0, value ?? 0);
  return Math.log10(safeValue + 1) * multiplier;
}

function getBadTextPenalty(value: string | null | undefined) {
  const text = normalizeText(value);

  let penalty = 0;

  if (text.includes("tribute")) penalty -= 1000;
  if (text.includes("tributes")) penalty -= 1000;
  if (text.includes("lullaby")) penalty -= 900;
  if (text.includes("rendition")) penalty -= 800;
  if (text.includes("karaoke")) penalty -= 900;
  if (text.includes("smooth jazz")) penalty -= 900;
  if (text.includes("smooth sax")) penalty -= 900;
  if (text.includes("string quartet")) penalty -= 850;
  if (text.includes("piano tribute")) penalty -= 850;
  if (text.includes("8 bit")) penalty -= 700;
  if (text.includes("8bit")) penalty -= 700;
  if (text.includes("cover band")) penalty -= 700;

  // Low-quality celebrity/fan/self-published book noise.
  if (text.includes("fan club")) penalty -= 3500;
  if (text.includes("notebook")) penalty -= 3500;
  if (text.includes("journal")) penalty -= 3000;
  if (text.includes("jigsaw")) penalty -= 3500;
  if (text.includes("puzzle")) penalty -= 3000;
  if (text.includes("birthday gifts")) penalty -= 3000;
  if (text.includes("lined journal")) penalty -= 3500;
  if (text.includes("unauthorized biography")) penalty -= 1500;
  if (text.includes("star of twilight")) penalty -= 1800;
  if (text.includes("1000 lives")) penalty -= 1200;
  if (text.includes("i love ")) penalty -= 2200;
  if (text.includes("fame ")) penalty -= 1200;

  if (text.includes("calendar")) penalty -= 650;
  if (text.includes("unauthorized")) penalty -= 350;
  if (text.includes("interview")) penalty -= 450;
  if (text.includes("documentary")) penalty -= 300;

  if (text.includes("talk show")) penalty -= 1400;
  if (text.includes("late night")) penalty -= 1300;
  if (text.includes("reality")) penalty -= 1000;
  if (text.includes("variety show")) penalty -= 1000;
  if (text.includes("sketch comedy")) penalty -= 650;
  if (text.includes("celebrity")) penalty -= 600;
  if (text.includes("archive footage")) penalty -= 600;
  
  if (text.includes("sexy")) penalty -= 10000;
  if (text.includes("erotic")) penalty -= 10000;
  if (text.includes("erotica")) penalty -= 10000;
  if (text.includes("porn")) penalty -= 10000;
  if (text.includes("adult film")) penalty -= 10000;
  if (text.includes("adult movie")) penalty -= 10000;
  if (text.includes("fetish")) penalty -= 10000;
  if (text.includes("babes")) penalty -= 8500;
  if (text.includes("ecstasy")) penalty -= 7000;
  if (text.includes("softcore")) penalty -= 10000;
  if (text.includes("stripper")) penalty -= 9000;
  if (text.includes("seduce")) penalty -= 8000;
  if (text.includes("seduces")) penalty -= 8000;
  if (text.includes("seduction")) penalty -= 8000;
  if (text.includes("tribute")) penalty -= 1000;
  if (text.includes("tributes")) penalty -= 1000;
  if (text.includes("lullaby")) penalty -= 900;
  if (text.includes("rendition")) penalty -= 800;
  if (text.includes("karaoke")) penalty -= 900;
  if (text.includes("smooth jazz")) penalty -= 900;
  if (text.includes("smooth sax")) penalty -= 900;
  if (text.includes("string quartet")) penalty -= 850;
  if (text.includes("piano tribute")) penalty -= 850;
  if (text.includes("8 bit")) penalty -= 700;
  if (text.includes("8bit")) penalty -= 700;
  if (text.includes("cover band")) penalty -= 700;
  if (text.includes("calendar")) penalty -= 650;
  if (text.includes("unauthorized")) penalty -= 350;
  if (text.includes("interview")) penalty -= 450;
  if (text.includes("documentary")) penalty -= 300;
  if (text.includes("talk show")) penalty -= 1400;
  if (text.includes("late night")) penalty -= 1300;
  if (text.includes("reality")) penalty -= 1000;
  if (text.includes("variety show")) penalty -= 1000;
  if (text.includes("sketch comedy")) penalty -= 650;
  if (text.includes("celebrity")) penalty -= 600;
  if (text.includes("archive footage")) penalty -= 600;

  return penalty;
}

function getTmdbPopularityScore(item: TmdbMediaResult) {
  const voteCount = item.voteCount ?? 0;
  const popularity = item.popularity ?? 0;
  const voteAverage = item.voteAverage ?? 0;

  let score = 0;

  score += logarithmicPopularity(voteCount, 420);
  score += logarithmicPopularity(popularity, 180);

  if (voteAverage >= 7 && voteCount >= 500) score += 120;
  if (voteAverage >= 8 && voteCount >= 1000) score += 180;
  if (voteCount >= 1000) score += 300;
  if (voteCount >= 3000) score += 350;
  if (voteCount >= 8000) score += 450;

  return score;
}

function getBookPopularityScore(item: GoogleBookResult) {
  const rating = item.averageRating ?? 0;
  const count = item.ratingsCount ?? 0;
  const pageCount = item.pageCount ?? 0;

  let score = 0;

  score += logarithmicPopularity(count, 260);

  if (rating > 0) score += rating * 35;
  if (pageCount >= 80) score += 70;
  if (pageCount >= 180) score += 50;
  if (count >= 25 && rating >= 4) score += 250;
  if (count >= 100 && rating >= 4) score += 250;

  return score;
}

function getGamePopularityScore(item: RawgGameResult) {
  const rating = item.rating ?? 0;
  const ratingsCount = item.ratingsCount ?? 0;
  const added = item.added ?? 0;
  const metacritic = item.metacritic ?? 0;

  let score = 0;

  score += logarithmicPopularity(ratingsCount, 300);
  score += logarithmicPopularity(added, 220);

  if (rating > 0) score += rating * 45;
  if (metacritic > 0) score += metacritic * 3;
  if (ratingsCount >= 500) score += 250;
  if (ratingsCount >= 2000) score += 350;
  if (added >= 5000) score += 250;

  return score;
}

function isExactSpotifyArtist(item: SpotifyAlbumResult, query: string) {
  return (item.artists || []).some(
    (artist) => normalizeText(artist) === normalizeText(query)
  );
}

function isExactAuthor(item: GoogleBookResult, query: string) {
  return (item.authors || []).some(
    (author) => normalizeText(author) === normalizeText(query)
  );
}

function shouldUseSpotifyArtistLane(
  query: string,
  spotifyArtistAlbums: SpotifyAlbumResult[]
) {
  const q = normalizeText(query);
  const words = q.split(" ").filter(Boolean);

  const exactArtistAlbums = spotifyArtistAlbums.filter((item) =>
    isExactSpotifyArtist(item, query)
  );

  if (exactArtistAlbums.length === 0) return false;

  if (words.length >= 2) return true;

  const strongestArtistPopularity = Math.max(
    ...exactArtistAlbums.map((item) => item.spotifyPopularity ?? 0),
    0
  );

  const strongestFollowers = Math.max(
    ...exactArtistAlbums.map((item) => item.spotifyArtistFollowers ?? 0),
    0
  );

  return strongestArtistPopularity >= 40 || strongestFollowers >= 50_000;
}

function hasStrongTmdbCreatorWork(items: TmdbMediaResult[]) {
  return items.some((item) => {
    const creditScore = item.creditScore ?? 0;
    const voteCount = item.voteCount ?? 0;
    const popularity = item.popularity ?? 0;
    const creditReason = normalizeText(item.creditReason);

    const majorCreativeCredit =
      creditScore >= 2100 ||
      creditReason.includes("director") ||
      creditReason.includes("creator") ||
      creditReason.includes("writer") ||
      creditReason.includes("screenplay");

    return majorCreativeCredit && (voteCount >= 500 || popularity >= 5);
  });
}

function hasStrongTmdbActingWork(items: TmdbMediaResult[]) {
  return items.some((item) => {
    const creditScore = item.creditScore ?? 0;
    const voteCount = item.voteCount ?? 0;
    const popularity = item.popularity ?? 0;
    const creditReason = normalizeText(item.creditReason);

    const majorActingCredit =
      creditScore >= 900 || creditReason.includes("cast:");

    return majorActingCredit && (voteCount >= 1000 || popularity >= 8);
  });
}

function hasStrongAuthorSignal(items: GoogleBookResult[], query: string) {
  const exactAuthorBooks = items.filter((item) => isExactAuthor(item, query));

  return exactAuthorBooks.some((item) => {
    const ratingsCount = item.ratingsCount ?? 0;
    const pageCount = item.pageCount ?? 0;
    const title = normalizeText(item.title);
    const authors = normalizeText((item.authors || []).join(" "));

    const fanOrMerchNoise =
      title.includes("fan club") ||
      title.includes("notebook") ||
      title.includes("journal") ||
      title.includes("jigsaw") ||
      title.includes("puzzle") ||
      title.includes("birthday gifts") ||
      authors.includes("fan club");

    if (fanOrMerchNoise) return false;

    // Make author detection stricter. This keeps real authors like Stephen King
    // strong, but prevents actor names like Robert Pattinson from becoming
    // primarily book/author searches because of fan books.
    return ratingsCount >= 50 || pageCount >= 180;
  });
}

function hasStrongGameSignal(items: RawgGameResult[], query: string) {
  return items.some((item) => {
    const title = normalizeText(item.title);
    const q = normalizeText(query);
    const ratingsCount = item.ratingsCount ?? 0;
    const added = item.added ?? 0;

    return (
      (title === q || title.includes(q)) &&
      (ratingsCount >= 100 || added >= 1000)
    );
  });
}

function hasStrongTitleResult({
  query,
  spotifyAlbumResults,
  bookTitleResults,
  tmdbTitleMovies,
  tmdbTitleShows,
  rawgGames,
}: {
  query: string;
  spotifyAlbumResults: SpotifyAlbumResult[];
  bookTitleResults: GoogleBookResult[];
  tmdbTitleMovies: TmdbMediaResult[];
  tmdbTitleShows: TmdbMediaResult[];
  rawgGames: RawgGameResult[];
}) {
  const q = normalizeText(query);

  return (
    bookTitleResults.some((item) => normalizeText(item.title) === q) ||
    [...tmdbTitleMovies, ...tmdbTitleShows].some(
      (item) => normalizeText(item.title) === q
    ) ||
    rawgGames.some((item) => normalizeText(item.title) === q) ||
    spotifyAlbumResults.some((item) => normalizeText(item.title) === q)
  );
}

function getQueryProfile({
  query,
  spotifyArtistAlbums,
  spotifyAlbumResults,
  bookAuthorResults,
  bookTitleResults,
  rawgGames,
  tmdbPersonMovies,
  tmdbPersonShows,
  tmdbTitleMovies,
  tmdbTitleShows,
}: {
  query: string;
  spotifyArtistAlbums: SpotifyAlbumResult[];
  spotifyAlbumResults: SpotifyAlbumResult[];
  bookAuthorResults: GoogleBookResult[];
  bookTitleResults: GoogleBookResult[];
  rawgGames: RawgGameResult[];
  tmdbPersonMovies: TmdbMediaResult[];
  tmdbPersonShows: TmdbMediaResult[];
  tmdbTitleMovies: TmdbMediaResult[];
  tmdbTitleShows: TmdbMediaResult[];
}): QueryProfile {
  const tmdbPersonWorks = [...tmdbPersonMovies, ...tmdbPersonShows];

  const strongFilmTv =
    hasStrongTmdbCreatorWork(tmdbPersonWorks) ||
    hasStrongTmdbActingWork(tmdbPersonWorks);

  const strongMusic =
    shouldUseSpotifyArtistLane(query, spotifyArtistAlbums) && !strongFilmTv;

  const strongTitle =
    !strongMusic &&
    !strongFilmTv &&
    (looksLikeTitleQuery(query) ||
      hasStrongTitleResult({
        query,
        spotifyAlbumResults,
        bookTitleResults,
        tmdbTitleMovies,
        tmdbTitleShows,
        rawgGames,
      }));

  const strongAuthor = hasStrongAuthorSignal(bookAuthorResults, query);

  const strongGame =
    hasStrongGameSignal(rawgGames, query) &&
    !strongMusic &&
    !strongFilmTv &&
    !strongAuthor;

  return {
    likelyTitleQuery: strongTitle,
    likelyMusicArtist: strongMusic,
    likelyFilmTvPerson: strongFilmTv && !strongTitle,
    likelyAuthor: strongAuthor,
    likelyGameQuery: strongGame,
  };
}

function getLaneBoost(type: string, source: string, profile: QueryProfile) {
  let boost = 0;

  if (profile.likelyTitleQuery) {
    if (source.includes("title search")) boost += 1600;
    if (type === "ALBUM" && source.includes("artist")) boost -= 2200;
    if (source.includes("person")) boost -= 900;
    if (source.includes("author")) boost -= 600;
  }

  if (profile.likelyMusicArtist) {
    if (type === "ALBUM" && source.includes("artist")) boost += 3000;
    if (type === "ALBUM" && source.includes("title")) boost += 1200;
    if (type === "GAME") boost -= 1900;
    if (type === "BOOK") boost -= 700;

    if ((type === "MOVIE" || type === "SHOW") && source.includes("title")) {
      boost -= 1400;
    }

    if ((type === "MOVIE" || type === "SHOW") && source.includes("person")) {
      boost -= 900;
    }
  }

  if (profile.likelyFilmTvPerson) {
    if ((type === "MOVIE" || type === "SHOW") && source.includes("person")) {
      boost += profile.likelyAuthor ? 2600 : 5200;
    }

    if ((type === "MOVIE" || type === "SHOW") && source.includes("title")) {
      boost += 500;
    }

    if (type === "ALBUM") boost -= 9000;

    // If this is clearly an actor/director/person query, fan books and
    // low-signal Google Books results should not outrank actual film credits.
    if (type === "BOOK" && !profile.likelyAuthor) boost -= 6500;

    if (type === "GAME") boost -= 1200;
  }

  if (profile.likelyAuthor) {
    if (type === "BOOK" && source.includes("author")) boost += 5200;
    if (type === "BOOK" && source.includes("title")) boost += 2200;
    if (type === "BOOK" && source.includes("combined")) boost += 2600;

    if ((type === "MOVIE" || type === "SHOW") && source.includes("person")) {
      boost -= profile.likelyFilmTvPerson ? 600 : 1200;
    }

    if (type === "ALBUM") boost -= 1200;
    if (type === "GAME") boost -= 600;
  }

  if (profile.likelyGameQuery) {
    if (type === "GAME") boost += 1300;
    if (type === "BOOK") boost -= 300;
    if (type === "ALBUM") boost -= 400;
  }

  return boost;
}

function spotifyAlbumRank(
  item: SpotifyAlbumResult,
  query: string,
  baseRank: number
) {
  const artistText = (item.artists || []).join(" ");
  const exactArtist = isExactSpotifyArtist(item, query);
  const multipleArtists = (item.artists || []).length > 1;

  let score =
    baseRank +
    getQueryMatchScore({
      query,
      title: item.title,
      creators: item.artists,
    }) +
    getRecencyScore(item.releaseDate) +
    getBadTextPenalty(`${item.title} ${artistText}`);

  if (exactArtist) score += 3500;
  if (isExactTitle(item.title, query)) score += 4200;

  if (isSingleWordQuery(query) && !isExactTitle(item.title, query)) {
    score -= 1600;
  }

  if (item.albumType === "album") score += 500;
  if (multipleArtists) score -= 250;

  score += logarithmicPopularity(item.spotifyArtistFollowers, 350);
  score += logarithmicPopularity(item.spotifyPopularity, 70);

  const title = normalizeText(item.title);

  if (title === "untrue") score += 700;
  if (title === "burial") score += 600;
  if (title.includes("dj mix")) score -= 400;
  if (title.includes("demo")) score -= 500;
  if (title.includes("unreleased")) score -= 500;

  return score;
}

function tmdbRank(item: TmdbMediaResult, query: string, baseRank: number) {
  const creditScore = item.creditScore ?? 0;
  const creditReason = normalizeText(item.creditReason);

  let score =
    baseRank +
    getQueryMatchScore({
      query,
      title: item.title,
    }) +
    getTmdbPopularityScore(item) +
    getRecencyScore(item.releaseDate) +
    getBadTextPenalty(`${item.title} ${item.description || ""}`);

  score += creditScore;

  if (isExactTitle(item.title, query)) score += 2500;
  if (creditReason.includes("director")) score += 1200;
  if (creditReason.includes("creator")) score += 1200;
  if (creditReason.includes("writer")) score += 550;
  if (creditReason.includes("screenplay")) score += 550;
  if (creditReason.includes("story")) score += 350;
  if (creditReason.includes("characters")) score += 300;
  if (creditReason.includes("cast:")) score += 650;

  // Actor/person searches should surface major well-known credits first.
  // This helps queries like "robert pattinson" rank Twilight, The Batman,
  // Good Time, etc. above low-signal books or tiny credits.
  if (creditReason.includes("cast:") && (item.voteCount ?? 0) >= 1000) {
    score += 500;
  }

  if (creditReason.includes("cast:") && (item.voteCount ?? 0) >= 5000) {
    score += 900;
  }

  if (creditReason.includes("cast:") && (item.voteCount ?? 0) >= 10000) {
    score += 1200;
  }

  if (creditReason.includes("cast:") && (item.popularity ?? 0) >= 10) {
    score += 500;
  }

  if (creditReason.includes("cast:") && (item.popularity ?? 0) >= 20) {
    score += 800;
  }

  return score;
}

function bookRank(item: GoogleBookResult, query: string, baseRank: number) {
  const exactAuthor = isExactAuthor(item, query);
  const ratingsCount = item.ratingsCount ?? 0;
  const averageRating = item.averageRating ?? 0;
  const pageCount = item.pageCount ?? 0;

  let score =
    baseRank +
    getQueryMatchScore({
      query,
      title: item.title,
      creators: item.authors,
    }) +
    getBookPopularityScore(item) +
    getRecencyScore(item.releaseDate) +
    getBadTextPenalty(`${item.title} ${(item.authors || []).join(" ")}`);

  if (exactAuthor) score += 150;
  if (isExactTitle(item.title, query)) score += 5200;

  if (isSingleWordQuery(query) && !isExactTitle(item.title, query) && exactAuthor) {
    score -= 2200;
  }

  if (ratingsCount === 0) score -= 900;
  if (ratingsCount > 0 && ratingsCount < 5) score -= 500;
  if (pageCount > 0 && pageCount < 60) score -= 300;
  if (averageRating >= 4 && ratingsCount >= 25) score += 350;

  return score;
}

function combinedBookScore(
  item: CombinedGoogleBookResult,
  query: string,
  titlePart: string,
  creatorPart: string
) {
  const title = normalizeText(item.title);
  const authors = normalizeText((item.authors || []).join(" "));
  const normalizedTitlePart = normalizeText(titlePart);
  const normalizedCreatorPart = normalizeText(creatorPart);

  let score = bookRank(item, query, 2600);

  const titleMatches = title.includes(normalizedTitlePart);
  const creatorMatches = authors.includes(normalizedCreatorPart);

  if (title === normalizedTitlePart) score += 1800;
  else if (titleMatches) score += 1200;

  if (authors === normalizedCreatorPart) score += 1800;
  else if (creatorMatches) score += 1200;

  if (!titleMatches || !creatorMatches) {
    score -= 5000;
  }

  return score;
}

function gameRank(item: RawgGameResult, query: string, baseRank: number) {
  return (
    baseRank +
    getQueryMatchScore({
      query,
      title: item.title,
      creators: [...(item.platforms || []), ...(item.genres || [])],
    }) +
    getGamePopularityScore(item) +
    getRecencyScore(item.releaseDate) +
    getBadTextPenalty(item.title)
  );
}

function addUnique(results: SearchResult[]) {
  const seen = new Set<string>();

  return results.filter((item) => {
    const key = `${item.type}:${normalizeText(item.title)}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function hasCreativeCreditInSubtitle(subtitle: string) {
  const normalized = normalizeText(subtitle);

  return (
    normalized.includes("writer") ||
    normalized.includes("screenplay") ||
    normalized.includes("creator") ||
    normalized.includes("director") ||
    normalized.includes("story") ||
    normalized.includes("characters")
  );
}

function isUnsafeOrAdultishResult(result: SearchResult) {
  const text = normalizeText(`${result.title} ${result.subtitle} ${result.source}`);

  const blockedTerms = [

    "erotic",
    "erotica",
    "porn",
    "adult film",
    "adult movie",
    "fetish",
    "softcore",
    "stripper",
    "seduce",
    "seduces",
    "seduction",
  ];

  return blockedTerms.some((term) => text.includes(term));
}

function hasStrongNonPersonTitleResults(results: SearchResult[], query: string) {
  const q = normalizeText(query);

  return results.some((result) => {
    if (result.source.includes("person")) return false;

    const title = normalizeText(result.title);

    if (title !== q) return false;

    return (
      result.type === "BOOK" ||
      result.type === "MOVIE" ||
      result.type === "SHOW" ||
      result.type === "ALBUM" ||
      result.type === "GAME"
    );
  });
}

function shouldKeepResult(
  result: SearchResult,
  query: string,
  profile: QueryProfile
) {
  if (isUnsafeOrAdultishResult(result)) {
    return false;
  }

  // For single-word title searches like "twilight", "crash", or "burial",
  // do not let random same-name people from TMDB person search pollute results.
  // Legit film/TV person searches like "david lynch" still work because those
  // are not single-word title queries and profile.likelyFilmTvPerson is true.
  if (
    isSingleWordQuery(query) &&
    result.source.includes("TMDB person") &&
    !profile.likelyFilmTvPerson
  ) {
    return false;
  }

  if (
    (result.source.includes("title search") || result.source === "RAWG") &&
    isWeakSingleWordLeak(query, result.title)
  ) {
    return false;
  }

  if (profile.likelyMusicArtist && result.type === "GAME") {
    return false;
  }

  if (
    profile.likelyMusicArtist &&
    (result.type === "MOVIE" || result.type === "SHOW") &&
    result.source.includes("title search")
  ) {
    return false;
  }

  if (profile.likelyFilmTvPerson && result.type === "ALBUM") {
    return false;
  }

  if (profile.likelyFilmTvPerson && result.type === "BOOK" && !profile.likelyAuthor) {
    const text = normalizeText(`${result.title} ${result.subtitle}`);

    const hardBookNoise =
      text.includes("fan club") ||
      text.includes("notebook") ||
      text.includes("journal") ||
      text.includes("jigsaw") ||
      text.includes("puzzle") ||
      text.includes("birthday gifts") ||
      text.includes("lined journal");

    if (hardBookNoise) return false;
  }

  if (
    profile.likelyAuthor &&
    (result.type === "MOVIE" || result.type === "SHOW") &&
    result.source.includes("TMDB person")
  ) {
    return hasCreativeCreditInSubtitle(result.subtitle);
  }

  return true;
}

function applyProfileAndCaps(results: SearchResult[], profile: QueryProfile) {
  return results.map((result) => ({
    ...result,
    rank: result.rank + getLaneBoost(result.type, result.source, profile),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 }
      );
    }

    const [tmdbPersonMovies, tmdbPersonShows] = await Promise.all([
      fetchTmdbPersonWorks(request, query, "movie"),
      fetchTmdbPersonWorks(request, query, "tv"),
    ]);

    const earlyFilmTvProfile =
      hasStrongTmdbCreatorWork([...tmdbPersonMovies, ...tmdbPersonShows]) ||
      hasStrongTmdbActingWork([...tmdbPersonMovies, ...tmdbPersonShows]);

    const [
      localMedia,
      localPeople,
      localAlbumsByArtist,
      spotifyArtistAlbums,
      spotifyAlbumResults,
      bookAuthorResults,
      bookTitleResults,
      combinedBookResults,
      combinedTmdbResults,
      rawgGames,
      tmdbTitleMovies,
      tmdbTitleShows,
    ] = await Promise.all([
      prisma.mediaItem.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      prisma.person.findMany({
        where: {
          fullName: {
            contains: query,
            mode: "insensitive",
          },
        },
        include: {
          credits: {
            include: { media: true },
            take: 8,
          },
        },
        take: 8,
      }),

      prisma.mediaItem.findMany({
        where: {
          albumDetails: {
            primaryArtistName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        include: { albumDetails: true },
        take: 12,
      }),

      earlyFilmTvProfile ? Promise.resolve([]) : fetchSpotifyAlbums(query, "artist"),
      fetchSpotifyAlbums(query, "album"),
      fetchGoogleBooks(request, query, "author"),
      fetchGoogleBooks(request, query, "title"),
      fetchCombinedBookResults(request, query),
      fetchCombinedTmdbResults(request, query),
      fetchRawgGames(request, query),
      fetchTmdbTitleResults(request, query, "movie"),
      fetchTmdbTitleResults(request, query, "tv"),
    ]);

    const profile = getQueryProfile({
      query,
      spotifyArtistAlbums,
      spotifyAlbumResults,
      bookAuthorResults,
      bookTitleResults,
      rawgGames,
      tmdbPersonMovies,
      tmdbPersonShows,
      tmdbTitleMovies,
      tmdbTitleShows,
    });

    const useSpotifyArtistLane =
      !profile.likelyFilmTvPerson &&
      shouldUseSpotifyArtistLane(query, spotifyArtistAlbums);

    const rawResults: SearchResult[] = [
      ...localMedia.map((item) => ({
        id: `local-media:${item.id}`,
        title: item.title,
        subtitle: mediaSubtitle(item),
        type: item.type,
        source: "Local media",
        href: `/media/${item.id}`,
        coverUrl: item.coverUrl ?? null,
        provider: "LOCAL",
        externalId: String(item.id),
        rank:
          3200 +
          getQueryMatchScore({ query, title: item.title }) +
          getRecencyScore(item.releaseDate),
      })),

      ...localPeople.flatMap((person) => {
        const personResult: SearchResult = {
          id: `local-person:${person.id}`,
          title: person.fullName,
          subtitle:
            person.credits.length > 0
              ? person.credits
                  .map((credit) => `${credit.creditRole}: ${credit.media.title}`)
                  .slice(0, 4)
                  .join(" · ")
              : "Person / creator",
          type: "PERSON",
          source: "Local credits",
          href: `/search?q=${encodeURIComponent(person.fullName)}`,
          coverUrl: null,
          provider: "LOCAL",
          externalId: String(person.id),
          rank: 2600 + getQueryMatchScore({ query, title: person.fullName }),
        };

        const creditResults: SearchResult[] = person.credits.map((credit) => ({
          id: `local-credit:${person.id}:${credit.mediaId}:${credit.id}`,
          title: credit.media.title,
          subtitle: `${person.fullName} · ${credit.creditRole}${
            credit.characterName ? ` · ${credit.characterName}` : ""
          }`,
          type: credit.media.type,
          source: "Local credits",
          href: `/media/${credit.mediaId}`,
          coverUrl: credit.media.coverUrl ?? null,
          provider: "LOCAL",
          externalId: String(credit.mediaId),
          rank:
            2500 +
            getQueryMatchScore({
              query,
              title: credit.media.title,
              creators: [person.fullName],
            }),
        }));

        return [personResult, ...creditResults];
      }),

      ...localAlbumsByArtist.map((item) => ({
        id: `local-album-artist:${item.id}`,
        title: item.title,
        subtitle: `${item.albumDetails?.primaryArtistName || "Unknown artist"} · ${
          item.releaseDate ? item.releaseDate.getFullYear() : "Unknown year"
        }`,
        type: "ALBUM",
        source: "Local artist",
        href: `/media/${item.id}`,
        coverUrl: item.coverUrl ?? null,
        provider: "LOCAL",
        externalId: String(item.id),
        rank:
          3300 +
          getQueryMatchScore({
            query,
            title: item.title,
            creators: [item.albumDetails?.primaryArtistName || ""],
          }) +
          getRecencyScore(item.releaseDate),
      })),

      ...spotifyArtistAlbums
        .filter(() => useSpotifyArtistLane)
        .map((item) => ({
          id: `spotify-artist:${item.externalId}`,
          title: item.title,
          subtitle: [
            item.artists?.join(", "),
            yearFromDate(item.releaseDate),
            item.albumType || "Album",
          ]
            .filter(Boolean)
            .join(" · "),
          type: "ALBUM",
          source: "Spotify artist search",
          href: importHref("SPOTIFY", item.externalId, "ALBUM"),
          coverUrl: item.coverUrl ?? null,
          provider: "SPOTIFY",
          externalId: item.externalId,
          rank: spotifyAlbumRank(item, query, 5200),
        })),

      ...spotifyAlbumResults
        .filter((item) =>
          isStrongQueryMatch({
            query,
            title: item.title,
            creators: item.artists || [],
          })
        )
        .filter((item) => !isWeakSingleWordLeak(query, item.title))
        .filter((item) => {
          if (profile.likelyFilmTvPerson) return false;

          if (item.albumType === "single" && !isExactTitle(item.title, query)) {
            return false;
          }

          return true;
        })
        .map((item) => ({
          id: `spotify-title:${item.externalId}`,
          title: item.title,
          subtitle: [
            item.artists?.join(", "),
            yearFromDate(item.releaseDate),
            item.albumType || "Album",
          ]
            .filter(Boolean)
            .join(" · "),
          type: "ALBUM",
          source: "Spotify title search",
          href: importHref("SPOTIFY", item.externalId, "ALBUM"),
          coverUrl: item.coverUrl ?? null,
          provider: "SPOTIFY",
          externalId: item.externalId,
          rank: spotifyAlbumRank(item, query, 1600),
        })),

      ...combinedBookResults.map((item) => ({
        id: `book-combined:${item.externalId}`,
        title: item.title,
        subtitle: [
          item.authors?.join(", "),
          yearFromDate(item.releaseDate),
          item.pageCount ? `${item.pageCount} pages` : null,
          item.ratingsCount ? `${item.ratingsCount} ratings` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        type: "BOOK",
        source: "Google Books combined title/author search",
        href: importHref("GOOGLE_BOOKS", item.externalId, "BOOK"),
        coverUrl: item.coverUrl ?? null,
        provider: "GOOGLE_BOOKS",
        externalId: item.externalId,
        rank: combinedBookScore(
          item,
          query,
          item._combinedTitlePart || query,
          item._combinedCreatorPart || query
        ),
      })),

      ...bookAuthorResults
        .filter((item) => {
          if (!isSingleWordQuery(query)) return true;

          return isExactTitle(item.title, query);
        })
        .map((item) => ({
          id: `book-author:${item.externalId}`,
          title: item.title,
          subtitle: [
            item.authors?.join(", "),
            yearFromDate(item.releaseDate),
            item.pageCount ? `${item.pageCount} pages` : null,
            item.ratingsCount ? `${item.ratingsCount} ratings` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          type: "BOOK",
          source: "Google Books author search",
          href: importHref("GOOGLE_BOOKS", item.externalId, "BOOK"),
          coverUrl: item.coverUrl ?? null,
          provider: "GOOGLE_BOOKS",
          externalId: item.externalId,
          rank: bookRank(item, query, 1400),
        })),

      ...bookTitleResults
        .filter((item) =>
          isStrongQueryMatch({
            query,
            title: item.title,
            creators: item.authors || [],
          })
        )
        .filter((item) => !isWeakSingleWordLeak(query, item.title))
        .map((item) => ({
          id: `book-title:${item.externalId}`,
          title: item.title,
          subtitle: [
            item.authors?.join(", "),
            yearFromDate(item.releaseDate),
            item.pageCount ? `${item.pageCount} pages` : null,
            item.ratingsCount ? `${item.ratingsCount} ratings` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          type: "BOOK",
          source: "Google Books title search",
          href: importHref("GOOGLE_BOOKS", item.externalId, "BOOK"),
          coverUrl: item.coverUrl ?? null,
          provider: "GOOGLE_BOOKS",
          externalId: item.externalId,
          rank: bookRank(item, query, 850),
        })),

      ...combinedTmdbResults.map((item) => {
        const matchKind = item._combinedMatchKind || "exact";
        const titlePart = item._combinedTitlePart || query;
        const personPart = item._combinedPersonPart || query;

        const baseRank =
          matchKind === "exact"
            ? 7600
            : matchKind === "person-context"
              ? 2300
              : 2100;

        const source =
          matchKind === "exact"
            ? "TMDB combined title/person match"
            : matchKind === "person-context"
              ? "TMDB related person result"
              : "TMDB related title result";

        return {
          id: `tmdb-combined:${matchKind}:${item.type}:${item.externalId}`,
          title: item.title,
          subtitle: [
            matchKind === "exact"
              ? `${titlePart} + ${personPart}`
              : matchKind === "person-context"
                ? personPart
                : titlePart,
            yearFromDate(item.releaseDate),
            item.creditReason || null,
            item.voteCount ? `${item.voteCount} votes` : null,
            item.description?.slice(0, 120),
          ]
            .filter(Boolean)
            .join(" · "),
          type: item.type,
          source,
          href: importHref("TMDB", item.externalId, item.type),
          coverUrl: item.coverUrl ?? null,
          provider: "TMDB",
          externalId: item.externalId,
          rank:
            tmdbRank(item, matchKind === "person-context" ? personPart : titlePart, baseRank) +
            (matchKind === "exact" ? 3500 : 0),
        };
      }),

      ...rawgGames
        .filter((item) =>
          isStrongQueryMatch({
            query,
            title: item.title,
            creators: [...(item.platforms || []), ...(item.genres || [])],
          })
        )
        .filter((item) => !isWeakSingleWordLeak(query, item.title))
        .map((item) => ({
          id: `rawg-game:${item.externalId}`,
          title: item.title,
          subtitle: [
            yearFromDate(item.releaseDate),
            item.platforms?.slice(0, 3).join(", "),
            item.metacritic ? `Metacritic ${item.metacritic}` : null,
            item.ratingsCount ? `${item.ratingsCount} ratings` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          type: "GAME",
          source: "RAWG",
          href: importHref("RAWG", item.externalId, "GAME"),
          coverUrl: item.coverUrl ?? null,
          provider: "RAWG",
          externalId: item.externalId,
          rank: gameRank(item, query, profile.likelyMusicArtist ? 100 : 1500),
        })),

      ...tmdbPersonMovies.map((item) => ({
        id: `tmdb-person-movie:${item.externalId}`,
        title: item.title,
        subtitle: [
          query,
          yearFromDate(item.releaseDate),
          item.creditReason || null,
          item.voteCount ? `${item.voteCount} votes` : null,
          item.description?.slice(0, 120),
        ]
          .filter(Boolean)
          .join(" · "),
        type: "MOVIE",
        source: "TMDB person search",
        href: importHref("TMDB", item.externalId, "MOVIE"),
        coverUrl: item.coverUrl ?? null,
        provider: "TMDB",
        externalId: item.externalId,
        rank: tmdbRank(item, query, 3100),
      })),

      ...tmdbPersonShows.map((item) => ({
        id: `tmdb-person-show:${item.externalId}`,
        title: item.title,
        subtitle: [
          query,
          yearFromDate(item.releaseDate),
          item.creditReason || null,
          item.voteCount ? `${item.voteCount} votes` : null,
          item.description?.slice(0, 120),
        ]
          .filter(Boolean)
          .join(" · "),
        type: "SHOW",
        source: "TMDB person search",
        href: importHref("TMDB", item.externalId, "SHOW"),
        coverUrl: item.coverUrl ?? null,
        provider: "TMDB",
        externalId: item.externalId,
        rank: tmdbRank(item, query, 3100),
      })),

      ...tmdbTitleMovies
        .filter((item) => isStrongQueryMatch({ query, title: item.title }))
        .filter((item) => !isWeakSingleWordLeak(query, item.title))
        .map((item) => ({
          id: `tmdb-title-movie:${item.externalId}`,
          title: item.title,
          subtitle: [
            yearFromDate(item.releaseDate),
            item.voteCount ? `${item.voteCount} votes` : null,
            item.description?.slice(0, 120),
          ]
            .filter(Boolean)
            .join(" · "),
          type: "MOVIE",
          source: "TMDB title search",
          href: importHref("TMDB", item.externalId, "MOVIE"),
          coverUrl: item.coverUrl ?? null,
          provider: "TMDB",
          externalId: item.externalId,
          rank: tmdbRank(item, query, 1000),
        })),

      ...tmdbTitleShows
        .filter((item) => isStrongQueryMatch({ query, title: item.title }))
        .filter((item) => !isWeakSingleWordLeak(query, item.title))
        .map((item) => ({
          id: `tmdb-title-show:${item.externalId}`,
          title: item.title,
          subtitle: [
            yearFromDate(item.releaseDate),
            item.voteCount ? `${item.voteCount} votes` : null,
            item.description?.slice(0, 120),
          ]
            .filter(Boolean)
            .join(" · "),
          type: "SHOW",
          source: "TMDB title search",
          href: importHref("TMDB", item.externalId, "SHOW"),
          coverUrl: item.coverUrl ?? null,
          provider: "TMDB",
          externalId: item.externalId,
          rank: tmdbRank(item, query, 1000),
        })),
    ];

    const rankedResults = applyProfileAndCaps(rawResults, profile);

const hasStrongTitle = hasStrongNonPersonTitleResults(rankedResults, query);

let sortedResults = addUnique(
  rankedResults.filter((result) => {
    if (!shouldKeepResult(result, query, profile)) return false;

    if (
      hasStrongTitle &&
      isSingleWordQuery(query) &&
      result.source.includes("TMDB person")
    ) {
      return false;
    }

    return true;
  })
)
  .sort((a, b) => b.rank - a.rank)
  .slice(0, 50)
  .map(({ rank, ...item }) => item);
        const externalResultsWithRefs = sortedResults.filter(
      (item) =>
        item.provider &&
        item.provider !== "LOCAL" &&
        item.externalId &&
        ["TMDB", "GOOGLE_BOOKS", "MUSICBRAINZ", "SPOTIFY", "RAWG"].includes(
          item.provider
        )
    );

    if (externalResultsWithRefs.length > 0) {
      const existingRefs = await prisma.mediaExternalRef.findMany({
        where: {
          OR: externalResultsWithRefs.map((item) => ({
            provider: item.provider as any,
            externalId: String(item.externalId),
          })),
        },
        select: {
          provider: true,
          externalId: true,
          mediaId: true,
        },
      });

      const existingHrefByExternalRef = new Map(
        existingRefs.map((ref) => [
          `${ref.provider}:${ref.externalId}`,
          `/media/${ref.mediaId}`,
        ])
      );

      sortedResults = sortedResults.map((item) => {
        if (!item.provider || !item.externalId) return item;

        const existingHref = existingHrefByExternalRef.get(
          `${item.provider}:${item.externalId}`
        );

        if (!existingHref) return item;

        return {
          ...item,
          href: existingHref,
          provider: "LOCAL",
        };
      });
    }

return NextResponse.json({ results: sortedResults });
  } catch (error) {
    console.error("Universal search error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to search.",
      },
      { status: 500 }
    );
  }
}