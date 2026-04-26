import { NextRequest, NextResponse } from "next/server";
import {
  getMusicBrainzExternalUrl,
  musicBrainzFetch,
} from "@/lib/musicbrainz";

type SearchBy = "title" | "artist";

type MusicBrainzArtistCredit = {
  name?: string;
  artist?: {
    id?: string;
    name?: string;
  };
};

type MusicBrainzRelease = {
  id?: string;
  title?: string;
  status?: string;
};

type MusicBrainzReleaseGroup = {
  id: string;
  title?: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  disambiguation?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
  count?: number;
  score?: number;
  _searchedArtistName?: string;
};

type MusicBrainzArtist = {
  id: string;
  name?: string;
  disambiguation?: string;
  score?: number;
  country?: string;
  type?: string;
};

type MusicBrainzReleaseGroupSearchResponse = {
  count?: number;
  offset?: number;
  "release-groups"?: MusicBrainzReleaseGroup[];
};

type MusicBrainzArtistSearchResponse = {
  count?: number;
  offset?: number;
  artists?: MusicBrainzArtist[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeMusicBrainzQuery(value: string) {
  return value.replace(/"/g, '\\"');
}

function getArtistNames(artistCredit?: MusicBrainzArtistCredit[]) {
  if (!artistCredit || artistCredit.length === 0) {
    return [];
  }

  return artistCredit
    .map((credit) => credit.name || credit.artist?.name)
    .filter((name): name is string => Boolean(name));
}

function getResultArtistNames(releaseGroup: MusicBrainzReleaseGroup) {
  const artists = getArtistNames(releaseGroup["artist-credit"]);

  if (artists.length > 0) {
    return artists;
  }

  return releaseGroup._searchedArtistName
    ? [releaseGroup._searchedArtistName]
    : [];
}

function getAlbumDescription(releaseGroup: MusicBrainzReleaseGroup) {
  const artists = getResultArtistNames(releaseGroup);
  const parts: string[] = [];

  if (artists.length > 0) {
    parts.push(`Album by ${artists.join(", ")}`);
  }

  if (releaseGroup["first-release-date"]) {
    parts.push(`First released ${releaseGroup["first-release-date"]}`);
  }

  if (releaseGroup.disambiguation) {
    parts.push(releaseGroup.disambiguation);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}

function isAlbumReleaseGroup(releaseGroup: MusicBrainzReleaseGroup) {
  const primaryType = releaseGroup["primary-type"];

  if (!primaryType) return true;

  return primaryType.toLowerCase() === "album";
}

function hasBadSecondaryType(releaseGroup: MusicBrainzReleaseGroup) {
  const secondaryTypes = releaseGroup["secondary-types"] || [];

  const badTypes = new Set([
    "compilation",
    "dj-mix",
    "mixtape/street",
    "remix",
    "soundtrack",
    "spokenword",
    "interview",
    "audiobook",
    "live",
  ]);

  return secondaryTypes.some((type) => badTypes.has(type.toLowerCase()));
}

function hasBadReleaseStatus(releaseGroup: MusicBrainzReleaseGroup) {
  const releases = releaseGroup.releases || [];

  if (releases.length === 0) return false;

  return releases.every((release) => {
    const status = normalizeText(release.status || "");

    return (
      status.includes("bootleg") ||
      status.includes("pseudo release") ||
      status.includes("withdrawn")
    );
  });
}

function looksLikeBadBootlegOrLive(releaseGroup: MusicBrainzReleaseGroup) {
  const title = normalizeText(releaseGroup.title || "");
  const disambiguation = normalizeText(releaseGroup.disambiguation || "");

  if (title.includes("bootleg")) return true;
  if (title.includes("live at")) return true;
  if (title.includes("live in")) return true;
  if (title.includes("live from")) return true;
  if (disambiguation.includes("bootleg")) return true;
  if (disambiguation.includes("live")) return true;

  return false;
}

function looksLikeTributeOrFakeArtistResult(
  releaseGroup: MusicBrainzReleaseGroup
) {
  const title = normalizeText(releaseGroup.title || "");
  const artistText = normalizeText(getResultArtistNames(releaseGroup).join(" "));
  const badText = `${title} ${artistText}`;

  return (
    badText.includes("tribute") ||
    badText.includes("tributes") ||
    badText.includes("lullaby") ||
    badText.includes("renditions") ||
    badText.includes("versions of") ||
    badText.includes("karaoke") ||
    badText.includes("smooth jazz") ||
    badText.includes("smooth sax") ||
    badText.includes("string quartet") ||
    badText.includes("piano tribute") ||
    badText.includes("8 bit") ||
    badText.includes("8bit") ||
    badText.includes("cover band") ||
    badText.includes("various artists")
  );
}

function releaseGroupHasExactArtist(
  releaseGroup: MusicBrainzReleaseGroup,
  query: string
) {
  const queryNormalized = normalizeText(query);
  const artists = getResultArtistNames(releaseGroup);

  return artists.some((artist) => normalizeText(artist) === queryNormalized);
}

function getTitleScore(query: string, releaseGroup: MusicBrainzReleaseGroup) {
  const queryNormalized = normalizeText(query);
  const titleNormalized = normalizeText(releaseGroup.title || "");
  const artistText = normalizeText(getResultArtistNames(releaseGroup).join(" "));
  const mbScore = releaseGroup.score ?? 0;
  const releaseCount = releaseGroup.count ?? releaseGroup.releases?.length ?? 0;

  let score = mbScore;

  const queryWords = queryNormalized.split(" ").filter(Boolean);
  const titleWords = titleNormalized.split(" ").filter(Boolean);

  const titleContainsAllWords = queryWords.every((word) =>
    titleNormalized.includes(word)
  );

  const exactTitle = titleNormalized === queryNormalized;
  const startsWithQuery = titleNormalized.startsWith(queryNormalized);
  const containsQuery = titleNormalized.includes(queryNormalized);

  if (exactTitle) score += 120;
  else if (startsWithQuery) score += 220;
  else if (containsQuery) score += 160;

  if (titleContainsAllWords) score += 180;

  score += Math.min(releaseCount, 40) * 12;

  if (releaseCount >= 5) score += 120;
  if (releaseCount >= 10) score += 160;
  if (releaseCount <= 1) score -= 120;

  if (releaseGroup["first-release-date"]) {
    const year = Number(releaseGroup["first-release-date"].slice(0, 4));

    if (!Number.isNaN(year)) {
      if (year < 2000) score += 180;
      else if (year < 2010) score += 80;
      else if (year > 2020) score -= 80;
    }
  }

  if (releaseGroup["primary-type"]?.toLowerCase() === "album") {
    score += 60;
  }

  if (hasBadSecondaryType(releaseGroup)) score -= 240;
  if (hasBadReleaseStatus(releaseGroup)) score -= 240;
  if (looksLikeBadBootlegOrLive(releaseGroup)) score -= 200;
  if (looksLikeTributeOrFakeArtistResult(releaseGroup)) score -= 500;

  if (titleWords.length > queryWords.length + 5 && releaseCount <= 2) {
    score -= 80;
  }

  if (exactTitle && releaseCount <= 1) {
    score -= 220;
  }

  if (
    queryNormalized.includes("selected ambient") &&
    artistText.includes("aphex twin")
  ) {
    score += 500;
  }

  return score;
}

function getArtistScore(query: string, artist: MusicBrainzArtist) {
  const queryNormalized = normalizeText(query);
  const artistName = normalizeText(artist.name || "");

  let score = artist.score ?? 0;

  if (artistName === queryNormalized) score += 1000;
  else if (artistName.startsWith(queryNormalized)) score += 120;
  else if (artistName.includes(queryNormalized)) score += 60;

  if (artistName.includes("tribute")) score -= 1000;
  if (artistName.includes("cover")) score -= 1000;
  if (artistName.includes("karaoke")) score -= 1000;
  if (artistName.includes("various artists")) score -= 1000;

  return score;
}

function getArtistAlbumScore(
  query: string,
  releaseGroup: MusicBrainzReleaseGroup
) {
  const releaseCount = releaseGroup.count ?? releaseGroup.releases?.length ?? 0;
  const titleNormalized = normalizeText(releaseGroup.title || "");

  let score = releaseGroup.score ?? 0;

  if (releaseGroupHasExactArtist(releaseGroup, query)) {
    score += 2000;
  }

  score += Math.min(releaseCount, 50) * 15;

  if (releaseCount >= 5) score += 150;
  if (releaseCount >= 10) score += 250;
  if (releaseCount <= 1) score -= 120;

  if (releaseGroup["primary-type"]?.toLowerCase() === "album") {
    score += 120;
  }

  if (releaseGroup["first-release-date"]) {
    const year = Number(releaseGroup["first-release-date"].slice(0, 4));

    if (!Number.isNaN(year)) {
      if (year >= 1960 && year <= 2025) score += 50;
      if (year > 2028) score -= 200;
    }
  }

  if (titleNormalized.includes("live")) score -= 200;
  if (looksLikeTributeOrFakeArtistResult(releaseGroup)) score -= 1200;
  if (hasBadSecondaryType(releaseGroup)) score -= 300;
  if (hasBadReleaseStatus(releaseGroup)) score -= 300;
  if (looksLikeBadBootlegOrLive(releaseGroup)) score -= 300;

  return score;
}

function toResult(releaseGroup: MusicBrainzReleaseGroup) {
  const artists = getResultArtistNames(releaseGroup);

  return {
    provider: "MUSICBRAINZ",
    externalId: releaseGroup.id,
    type: "ALBUM",
    title: releaseGroup.title || "Untitled Album",
    description: getAlbumDescription(releaseGroup),
    releaseDate: releaseGroup["first-release-date"] || null,
    coverUrl: null,
    backdropUrl: null,
    languageCode: null,
    externalUrl: getMusicBrainzExternalUrl("release-group", releaseGroup.id),
    artists,
    primaryType: releaseGroup["primary-type"] || null,
    secondaryTypes: releaseGroup["secondary-types"] || [],
    disambiguation: releaseGroup.disambiguation || null,
    raw: releaseGroup,
  };
}

async function searchReleaseGroups(query: string, limit = 25) {
  const data = await musicBrainzFetch<MusicBrainzReleaseGroupSearchResponse>(
    "/release-group",
    {
      query,
      limit,
      offset: 0,
      inc: "artist-credits",
    }
  );

  return data["release-groups"] || [];
}

async function browseReleaseGroupsByArtistId(
  artistId: string,
  searchedArtistName: string
) {
  const data = await musicBrainzFetch<MusicBrainzReleaseGroupSearchResponse>(
    "/release-group",
    {
      artist: artistId,
      type: "album",
      limit: 100,
      offset: 0,
      inc: "artist-credits",
    }
  );

  return (data["release-groups"] || []).map((releaseGroup) => ({
    ...releaseGroup,
    _searchedArtistName: searchedArtistName,
  }));
}

async function searchByTitle(query: string) {
  const queryNormalized = normalizeText(query);
  const queryWords = queryNormalized.split(" ").filter(Boolean);
  const escapedQuery = escapeMusicBrainzQuery(query);

  const [strictResults, looseResults, releaseGroupFieldResults] =
    await Promise.all([
      searchReleaseGroups(`"${escapedQuery}"`, 25),
      searchReleaseGroups(query, 25),
      searchReleaseGroups(`releasegroup:"${escapedQuery}"`, 25),
    ]);

  const allResults = [
    ...strictResults,
    ...releaseGroupFieldResults,
    ...looseResults,
  ];

  const seen = new Set<string>();

  return allResults
    .filter((releaseGroup) => releaseGroup.id)
    .filter((releaseGroup) => {
      if (seen.has(releaseGroup.id)) return false;
      seen.add(releaseGroup.id);
      return true;
    })
    .filter(isAlbumReleaseGroup)
    .filter((releaseGroup) => !hasBadSecondaryType(releaseGroup))
    .filter((releaseGroup) => !hasBadReleaseStatus(releaseGroup))
    .filter((releaseGroup) => !looksLikeBadBootlegOrLive(releaseGroup))
    .filter((releaseGroup) => !looksLikeTributeOrFakeArtistResult(releaseGroup))
    .filter((releaseGroup) => {
      const titleNormalized = normalizeText(releaseGroup.title || "");

      if (!titleNormalized) return false;

      const exactOrStrongMatch =
        titleNormalized === queryNormalized ||
        titleNormalized.startsWith(queryNormalized) ||
        titleNormalized.includes(queryNormalized) ||
        queryNormalized.includes(titleNormalized);

      if (exactOrStrongMatch) return true;

      return queryWords.every((word) => titleNormalized.includes(word));
    })
    .sort((a, b) => getTitleScore(query, b) - getTitleScore(query, a))
    .slice(0, 12)
    .map(toResult);
}

async function searchArtists(query: string) {
  const escapedQuery = escapeMusicBrainzQuery(query);
  const queryNormalized = normalizeText(query);

  const [looseData, exactData, yeData] = await Promise.all([
    musicBrainzFetch<MusicBrainzArtistSearchResponse>("/artist", {
      query,
      limit: 12,
      offset: 0,
    }),
    musicBrainzFetch<MusicBrainzArtistSearchResponse>("/artist", {
      query: `artist:"${escapedQuery}" OR alias:"${escapedQuery}"`,
      limit: 12,
      offset: 0,
    }),
    normalizeText(query) === "kanye west"
      ? musicBrainzFetch<MusicBrainzArtistSearchResponse>("/artist", {
          query: `artist:"Ye" OR alias:"Kanye West"`,
          limit: 12,
          offset: 0,
        })
      : Promise.resolve({ artists: [] }),
  ]);

  const seen = new Set<string>();

  const artists = [
    ...(exactData.artists || []),
    ...(yeData.artists || []),
    ...(looseData.artists || []),
  ]
    .filter((artist) => artist.id && artist.name)
    .filter((artist) => {
      if (seen.has(artist.id)) return false;
      seen.add(artist.id);
      return true;
    });

  const exactNameMatches = artists.filter((artist) => {
    const artistName = normalizeText(artist.name || "");
    return artistName === queryNormalized;
  });

  if (exactNameMatches.length > 0) {
    return exactNameMatches
      .sort((a, b) => getArtistScore(query, b) - getArtistScore(query, a))
      .slice(0, 2);
  }

  return artists
    .filter((artist) => {
      const artistName = normalizeText(artist.name || "");

      if (artistName.includes("tribute")) return false;
      if (artistName.includes("cover")) return false;
      if (artistName.includes("karaoke")) return false;
      if (artistName.includes("various artists")) return false;

      return (
        artistName === queryNormalized ||
        artistName.startsWith(queryNormalized) ||
        artistName.includes(queryNormalized) ||
        (queryNormalized === "kanye west" && artistName === "ye")
      );
    })
    .sort((a, b) => getArtistScore(query, b) - getArtistScore(query, a))
    .slice(0, 3);
}

async function searchByArtist(query: string) {
  const artists = await searchArtists(query);
  const releaseGroups: MusicBrainzReleaseGroup[] = [];

  for (const artist of artists) {
    if (!artist.id || !artist.name) continue;

    const escapedArtistName = escapeMusicBrainzQuery(artist.name);
    const escapedQuery = escapeMusicBrainzQuery(query);

    const [browseResults, artistFieldResults, queryArtistFieldResults] =
      await Promise.all([
        browseReleaseGroupsByArtistId(artist.id, query),
        searchReleaseGroups(`artist:"${escapedArtistName}"`, 50),
        searchReleaseGroups(`artist:"${escapedQuery}"`, 50),
      ]);

    const taggedArtistFieldResults = artistFieldResults.map((releaseGroup) => ({
      ...releaseGroup,
      _searchedArtistName: query,
    }));

    const taggedQueryArtistFieldResults = queryArtistFieldResults.map(
      (releaseGroup) => ({
        ...releaseGroup,
        _searchedArtistName: query,
      })
    );

    releaseGroups.push(
      ...browseResults,
      ...taggedArtistFieldResults,
      ...taggedQueryArtistFieldResults
    );
  }

  const seen = new Set<string>();

  return releaseGroups
    .filter((releaseGroup) => releaseGroup.id)
    .filter((releaseGroup) => {
      if (seen.has(releaseGroup.id)) return false;
      seen.add(releaseGroup.id);
      return true;
    })
    .filter(isAlbumReleaseGroup)
    .filter((releaseGroup) => releaseGroupHasExactArtist(releaseGroup, query))
    .filter((releaseGroup) => !looksLikeTributeOrFakeArtistResult(releaseGroup))
    .filter((releaseGroup) => !hasBadSecondaryType(releaseGroup))
    .filter((releaseGroup) => !hasBadReleaseStatus(releaseGroup))
    .filter((releaseGroup) => !looksLikeBadBootlegOrLive(releaseGroup))
    .sort((a, b) => getArtistAlbumScore(query, b) - getArtistAlbumScore(query, a))
    .slice(0, 15)
    .map(toResult);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q")?.trim();
    const searchBy = (searchParams.get("searchBy") || "title") as SearchBy;

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 }
      );
    }

    const results =
      searchBy === "artist"
        ? await searchByArtist(query)
        : await searchByTitle(query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("MusicBrainz search error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search MusicBrainz.",
      },
      { status: 500 }
    );
  }
}