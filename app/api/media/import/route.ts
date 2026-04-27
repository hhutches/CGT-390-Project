import { prisma } from "@/lib/prisma";
import {
  getCoverArtArchiveReleaseGroupImage,
  getMusicBrainzExternalUrl,
  musicBrainzFetch,
} from "@/lib/musicbrainz";
import { ExternalProvider, MediaType } from "@prisma/client";
import { NextResponse } from "next/server";

function tmdbImage(path: string | null | undefined) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

function secureImage(url?: string | null) {
  if (!url) return null;
  return url.replace("http://", "https://");
}

function normalizeFlexibleDate(value?: string | null) {
  if (!value) return null;

  if (/^\d{4}$/.test(value)) {
    return new Date(`${value}-01-01`);
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getGoogleBookIsbn(info: any) {
  const identifiers = info.industryIdentifiers ?? [];

  return (
    identifiers.find((item: any) => item.type === "ISBN_13")?.identifier ??
    identifiers.find((item: any) => item.type === "ISBN_10")?.identifier ??
    null
  );
}

function getTmdbEndpoint(type: MediaType, externalId: string) {
  if (type === MediaType.SHOW) {
    return `https://api.themoviedb.org/3/tv/${externalId}`;
  }

  return `https://api.themoviedb.org/3/movie/${externalId}`;
}

function getTmdbExternalUrl(type: MediaType, externalId: string) {
  if (type === MediaType.SHOW) {
    return `https://www.themoviedb.org/tv/${externalId}`;
  }

  return `https://www.themoviedb.org/movie/${externalId}`;
}

function getRawgExternalUrl(details: RawgGameDetails, externalId: string) {
  if (details.slug) {
    return `https://rawg.io/games/${details.slug}`;
  }

  return `https://rawg.io/games/${externalId}`;
}

type MusicBrainzArtistCredit = {
  name?: string;
  artist?: {
    id?: string;
    name?: string;
  };
};

type MusicBrainzGenre = {
  id?: string;
  name?: string;
  count?: number;
};

type MusicBrainzReleaseGroupDetails = {
  id: string;
  title?: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  disambiguation?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  genres?: MusicBrainzGenre[];
  tags?: MusicBrainzGenre[];
};

type RawgGameDetails = {
  id: number;
  slug?: string;
  name?: string;
  name_original?: string;
  description_raw?: string | null;
  description?: string | null;
  released?: string | null;
  background_image?: string | null;
  background_image_additional?: string | null;
  website?: string | null;
  playtime?: number | null;
  metacritic?: number | null;
  rating?: number | null;
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
  developers?: Array<{
    id?: number;
    name?: string;
    slug?: string;
  }>;
  publishers?: Array<{
    id?: number;
    name?: string;
    slug?: string;
  }>;
  tags?: Array<{
    id?: number;
    name?: string;
    slug?: string;
    language?: string;
  }>;
};

function getMusicBrainzArtistNames(artistCredit?: MusicBrainzArtistCredit[]) {
  if (!artistCredit || artistCredit.length === 0) {
    return [];
  }

  return artistCredit
    .map((credit) => credit.name || credit.artist?.name)
    .filter((name): name is string => Boolean(name));
}

function getMusicBrainzAlbumDescription(details: MusicBrainzReleaseGroupDetails) {
  const artists = getMusicBrainzArtistNames(details["artist-credit"]);
  const parts: string[] = [];

  if (artists.length > 0) {
    parts.push(`Album by ${artists.join(", ")}`);
  }

  if (details["first-release-date"]) {
    parts.push(`First released ${details["first-release-date"]}`);
  }

  if (details.disambiguation) {
    parts.push(details.disambiguation);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}

function getRawgGameDescription(details: RawgGameDetails) {
  if (details.description_raw) {
    return details.description_raw;
  }

  if (details.description) {
    return details.description;
  }

  const parts: string[] = [];

  const developers = (details.developers ?? [])
    .map((developer) => developer.name)
    .filter((name): name is string => Boolean(name));

  const genres = (details.genres ?? [])
    .map((genre) => genre.name)
    .filter((name): name is string => Boolean(name));

  if (developers.length > 0) {
    parts.push(`Game by ${developers.join(", ")}`);
  }

  if (details.released) {
    parts.push(`Released ${details.released}`);
  }

  if (genres.length > 0) {
    parts.push(`Genres: ${genres.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}

function getRawgMultiplayer(details: RawgGameDetails) {
  const tagNames = (details.tags ?? [])
    .map((tag) => tag.name?.toLowerCase())
    .filter((name): name is string => Boolean(name));

  return tagNames.some(
    (name) =>
      name.includes("multiplayer") ||
      name.includes("co-op") ||
      name.includes("coop") ||
      name.includes("online co-op")
  );
}

function getMediaInclude() {
  return {
    movieDetails: true,
    showDetails: true,
    bookDetails: true,
    albumDetails: true,
    gameDetails: true,
    externalRefs: true,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const provider = body.provider as ExternalProvider;
    const externalId = String(body.externalId ?? "");
    const type = body.type as MediaType;

    if (!provider || !externalId || !type) {
      return NextResponse.json(
        { error: "provider, externalId, and type are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.mediaExternalRef.findUnique({
      where: {
        provider_externalId: {
          provider,
          externalId,
        },
      },
      include: {
        media: {
          include: getMediaInclude(),
        },
      },
    });

    if (existing) {
      if (
        provider === ExternalProvider.MUSICBRAINZ &&
        type === MediaType.ALBUM &&
        !existing.media.coverUrl
      ) {
        const coverUrl = await getCoverArtArchiveReleaseGroupImage(externalId);

        if (coverUrl) {
          const media = await prisma.mediaItem.update({
            where: {
              id: existing.media.id,
            },
            data: {
              coverUrl,
            },
            include: getMediaInclude(),
          });

          return NextResponse.json({
            imported: false,
            refreshed: true,
            alreadyImported: true,
            mediaId: media.id,
            media,
          });
        }
      }

      return NextResponse.json({
        imported: false,
        refreshed: false,
        alreadyImported: true,
        mediaId: existing.media.id,
        media: existing.media,
      });
    }

    if (provider === ExternalProvider.TMDB) {
      if (type !== MediaType.MOVIE && type !== MediaType.SHOW) {
        return NextResponse.json(
          { error: "TMDB import only supports MOVIE and SHOW." },
          { status: 400 }
        );
      }

      const token = process.env.TMDB_ACCESS_TOKEN;

      if (!token) {
        return NextResponse.json(
          { error: "Missing TMDB_ACCESS_TOKEN." },
          { status: 500 }
        );
      }

      const response = await fetch(getTmdbEndpoint(type, externalId), {
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        next: {
          revalidate: 86400,
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            error: "TMDB details fetch failed.",
            status: response.status,
          },
          { status: response.status }
        );
      }

      const details = await response.json();

      if (type === MediaType.MOVIE) {
        const media = await prisma.mediaItem.create({
          data: {
            type: MediaType.MOVIE,
            title: details.title ?? "Untitled Movie",
            originalTitle: details.original_title ?? null,
            description: details.overview ?? null,
            releaseDate: details.release_date
              ? new Date(details.release_date)
              : null,
            coverUrl: tmdbImage(details.poster_path),
            backdropUrl: tmdbImage(details.backdrop_path),
            languageCode: details.original_language ?? null,

            movieDetails: {
              create: {
                runtimeMinutes: details.runtime ?? null,
              },
            },

            externalRefs: {
              create: {
                provider: ExternalProvider.TMDB,
                externalId,
                externalUrl: getTmdbExternalUrl(MediaType.MOVIE, externalId),
                rawPayload: details,
                lastSyncedAt: new Date(),
              },
            },
          },
          include: getMediaInclude(),
        });

        return NextResponse.json({
          imported: true,
          refreshed: false,
          media,
        });
      }

      const media = await prisma.mediaItem.create({
        data: {
          type: MediaType.SHOW,
          title: details.name ?? "Untitled Show",
          originalTitle: details.original_name ?? null,
          description: details.overview ?? null,
          releaseDate: details.first_air_date
            ? new Date(details.first_air_date)
            : null,
          coverUrl: tmdbImage(details.poster_path),
          backdropUrl: tmdbImage(details.backdrop_path),
          languageCode: details.original_language ?? null,

          showDetails: {
            create: {
              seasonsCount: details.number_of_seasons ?? null,
              episodesCount: details.number_of_episodes ?? null,
              avgRuntimeMinutes:
                Array.isArray(details.episode_run_time) &&
                details.episode_run_time.length > 0
                  ? details.episode_run_time[0]
                  : null,
              showStatus: details.status ?? null,
            },
          },

          externalRefs: {
            create: {
              provider: ExternalProvider.TMDB,
              externalId,
              externalUrl: getTmdbExternalUrl(MediaType.SHOW, externalId),
              rawPayload: details,
              lastSyncedAt: new Date(),
            },
          },
        },
        include: getMediaInclude(),
      });

      return NextResponse.json({
        imported: true,
        refreshed: false,
        media,
      });
    }

    if (provider === ExternalProvider.GOOGLE_BOOKS) {
      if (type !== MediaType.BOOK) {
        return NextResponse.json(
          { error: "Google Books import only supports BOOK." },
          { status: 400 }
        );
      }

      const url = new URL(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
          externalId
        )}`
      );

      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

      if (apiKey) {
        url.searchParams.set("key", apiKey);
      }

      const response = await fetch(url.toString(), {
        next: {
          revalidate: 86400,
        },
      });

      if (!response.ok) {
        let googleResponse: unknown = null;

        try {
          googleResponse = await response.json();
        } catch {
          googleResponse = null;
        }

        return NextResponse.json(
          {
            error: "Google Books details fetch failed.",
            status: response.status,
            googleResponse,
          },
          { status: response.status }
        );
      }

      const details = await response.json();
      const info = details.volumeInfo ?? {};

      const title = info.subtitle
        ? `${info.title ?? "Untitled Book"}: ${info.subtitle}`
        : info.title ?? "Untitled Book";

      const isbn = getGoogleBookIsbn(info);

      const media = await prisma.mediaItem.create({
        data: {
          type: MediaType.BOOK,
          title,
          originalTitle: info.title ?? null,
          description: info.description ?? null,
          releaseDate: normalizeFlexibleDate(info.publishedDate),
          coverUrl:
            secureImage(info.imageLinks?.thumbnail) ??
            secureImage(info.imageLinks?.smallThumbnail),
          backdropUrl: null,
          languageCode: info.language ?? null,

          bookDetails: {
            create: {
              pageCount: info.pageCount ?? null,
              estimatedReadTimeMinutes: info.pageCount
                ? info.pageCount * 2
                : null,
              isbn13: isbn,
            },
          },

          externalRefs: {
            create: {
              provider: ExternalProvider.GOOGLE_BOOKS,
              externalId,
              externalUrl: info.infoLink ?? null,
              rawPayload: details,
              lastSyncedAt: new Date(),
            },
          },
        },
        include: getMediaInclude(),
      });

      return NextResponse.json({
        imported: true,
        refreshed: false,
        media,
      });
    }

    if (provider === ExternalProvider.MUSICBRAINZ) {
      if (type !== MediaType.ALBUM) {
        return NextResponse.json(
          { error: "MusicBrainz import only supports ALBUM." },
          { status: 400 }
        );
      }

      const details = await musicBrainzFetch<MusicBrainzReleaseGroupDetails>(
        `/release-group/${encodeURIComponent(externalId)}`,
        {
          inc: "artist-credits+genres+tags",
        }
      );

      const artists = getMusicBrainzArtistNames(details["artist-credit"]);
      const artistText = artists.length > 0 ? artists.join(", ") : null;

      const genreNames = (details.genres ?? [])
        .map((genre) => genre.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 5);

      const description = getMusicBrainzAlbumDescription(details);
      const coverUrl = await getCoverArtArchiveReleaseGroupImage(externalId);

      const media = await prisma.mediaItem.create({
        data: {
          type: MediaType.ALBUM,
          title: details.title ?? "Untitled Album",
          originalTitle: details.title ?? null,
          description,
          releaseDate: normalizeFlexibleDate(details["first-release-date"]),
          coverUrl,
          backdropUrl: null,
          languageCode: null,

          albumDetails: {
            create: {
              primaryArtistName: artistText,
              totalTracks: null,
              durationSeconds: null,
            },
          },

          externalRefs: {
            create: {
              provider: ExternalProvider.MUSICBRAINZ,
              externalId,
              externalUrl: getMusicBrainzExternalUrl(
                "release-group",
                externalId
              ),
              rawPayload: {
                ...details,
                normalizedArtists: artists,
                normalizedGenres: genreNames,
              },
              lastSyncedAt: new Date(),
            },
          },
        },
        include: getMediaInclude(),
      });

      return NextResponse.json({
        imported: true,
        refreshed: false,
        media,
      });
    }

    if (provider === ExternalProvider.RAWG) {
      if (type !== MediaType.GAME) {
        return NextResponse.json(
          { error: "RAWG import only supports GAME." },
          { status: 400 }
        );
      }

      const apiKey = process.env.RAWG_API_KEY;

      if (!apiKey) {
        return NextResponse.json(
          { error: "Missing RAWG_API_KEY." },
          { status: 500 }
        );
      }

      const url = new URL(
        `https://api.rawg.io/api/games/${encodeURIComponent(externalId)}`
      );

      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: 86400,
        },
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
            error: "RAWG details fetch failed.",
            status: response.status,
            rawgResponse,
          },
          { status: response.status }
        );
      }

      const details = (await response.json()) as RawgGameDetails;

      const genreNames = (details.genres ?? [])
        .map((genre) => genre.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 5);

      const developerNames = (details.developers ?? [])
        .map((developer) => developer.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 5);

      const platformNames = (details.platforms ?? [])
        .map((item) => item.platform?.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 10);

      const media = await prisma.mediaItem.create({
        data: {
          type: MediaType.GAME,
          title: details.name ?? "Untitled Game",
          originalTitle: details.name_original ?? details.name ?? null,
          description: getRawgGameDescription(details),
          releaseDate: normalizeFlexibleDate(details.released),
          coverUrl: secureImage(details.background_image),
          backdropUrl: secureImage(details.background_image_additional),
          languageCode: null,

          gameDetails: {
            create: {
              timeToBeatHours: null,
              multiplayer: getRawgMultiplayer(details),
            },
          },

          externalRefs: {
            create: {
              provider: ExternalProvider.RAWG,
              externalId,
              externalUrl: getRawgExternalUrl(details, externalId),
              rawPayload: {
                ...details,
                normalizedGenres: genreNames,
                normalizedDevelopers: developerNames,
                normalizedPlatforms: platformNames,
              },
              lastSyncedAt: new Date(),
            },
          },
        },
        include: getMediaInclude(),
      });

      return NextResponse.json({
        imported: true,
        refreshed: false,
        media,
      });
    }

    return NextResponse.json(
      { error: "Unsupported provider." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Import route error:", error);

    return NextResponse.json(
      {
        error: "Internal import error.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}