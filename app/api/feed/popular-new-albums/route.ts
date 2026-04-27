import { NextResponse } from "next/server";

type SpotifyImage = {
  url: string;
  height?: number | null;
  width?: number | null;
};

type SpotifyAlbum = {
  id: string;
  name: string;
  album_type?: string;
  release_date?: string;
  total_tracks?: number;
  images?: SpotifyImage[];
  artists?: Array<{
    id?: string;
    name?: string;
  }>;
};

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Spotify token request failed: ${response.status} ${body}`);
  }

  const data = await response.json();

  if (!data?.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }

  return String(data.access_token);
}

function getBestSpotifyImage(images: SpotifyImage[] | null | undefined) {
  if (!images || images.length === 0) return null;

  return [...images].sort((a, b) => {
    const aSize = a.width ?? a.height ?? 0;
    const bSize = b.width ?? b.height ?? 0;

    return bSize - aSize;
  })[0]?.url ?? null;
}

async function searchSpotifyAlbums(token: string, query: string) {
  const url = new URL("https://api.spotify.com/v1/search");

  url.searchParams.set("q", query);
  url.searchParams.set("type", "album");
  url.searchParams.set("market", "US");
  url.searchParams.set("limit", "20");
  url.searchParams.set("offset", "0");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Spotify album search failed: ${response.status} ${body}`);
  }

  const data = await response.json();

  return Array.isArray(data?.albums?.items)
    ? (data.albums.items as SpotifyAlbum[])
    : [];
}

export async function GET() {
  try {
    const token = await getSpotifyAccessToken();

    const currentYear = new Date().getFullYear();

    const queries = [
      `year:${currentYear}`,
      `year:${currentYear - 1}`,
      `year:${currentYear - 2}`,
    ];

    const pages = await Promise.all(
      queries.map((query) => searchSpotifyAlbums(token, query))
    );

    const albums = pages.flat();

    const seen = new Set<string>();

    const popularAlbums = albums
      .filter((album) => album.id && album.name)
      .filter((album) => album.album_type === "album")
      .filter((album) => {
        if (seen.has(album.id)) return false;

        seen.add(album.id);
        return true;
      })
      .slice(0, 40)
      .map((album, index) => {
        const artists =
          album.artists
            ?.map((artist) => artist.name)
            .filter((name): name is string => Boolean(name)) ?? [];

        return {
          id: index + 1,
          eventType: "POPULAR",
          bodyText:
            artists.length > 0
              ? `Album by ${artists.join(", ")}.`
              : "Album on Spotify.",
          ratingValue: null,
          createdAt: new Date().toISOString(),
          entry: {
            id: index + 1,
            status: "POPULAR",
            reviewText: null,
            user: {
              id: "spotify",
              username: "spotify",
              displayName: "Spotify",
              avatarUrl: null,
            },
            media: {
              id: index + 1,
              provider: "SPOTIFY",
              externalId: album.id,
              type: "ALBUM",
              title: album.name,
              releaseDate: album.release_date || null,
              coverUrl: getBestSpotifyImage(album.images),
              movieDetails: null,
              showDetails: null,
              bookDetails: null,
              albumDetails: {
                totalTracks: album.total_tracks ?? null,
                durationSeconds: null,
                primaryArtistName:
                  artists.length > 0 ? artists.join(", ") : null,
              },
              gameDetails: null,
            },
          },
        };
      });

    return NextResponse.json(popularAlbums);
  } catch (error) {
    console.error("Spotify popular new albums error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load popular new albums.",
      },
      { status: 500 }
    );
  }
}