import { NextRequest, NextResponse } from "next/server";
import {
  getBestSpotifyImage,
  getSpotifyArtistAlbums,
  normalizeSpotifyText,
  searchSpotifyAlbums,
  searchSpotifyArtists,
  type SpotifyAlbum,
  type SpotifyArtist,
} from "@/lib/spotify";

type SearchBy = "artist" | "album";

function normalizeSearchBy(value: string | null): SearchBy {
  if (value === "album") return "album";
  return "artist";
}

function albumKey(album: SpotifyAlbum) {
  return normalizeSpotifyText(
    `${album.name}:${album.artists.map((artist) => artist.name).join(",")}`
  );
}

function getArtistScore(query: string, artist: SpotifyArtist) {
  const q = normalizeSpotifyText(query);
  const name = normalizeSpotifyText(artist.name);

  let score = artist.popularity ?? 0;

  score += Math.log10((artist.followers?.total ?? 0) + 1) * 12;

  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 300;
  else if (name.includes(q)) score += 120;

  return score;
}

function getAlbumScore(
  query: string,
  album: SpotifyAlbum,
  searchedArtist?: SpotifyArtist
) {
  const q = normalizeSpotifyText(query);
  const title = normalizeSpotifyText(album.name);
  const artistNames = album.artists.map((artist) => artist.name);
  const artistText = normalizeSpotifyText(artistNames.join(" "));

  let score = searchedArtist?.popularity ?? 0;

  if (searchedArtist) score += 1000;

  if (artistText === q) score += 900;
  else if (artistText.includes(q)) score += 450;

  if (title === q) score += 700;
  else if (title.startsWith(q)) score += 300;
  else if (title.includes(q)) score += 150;

  if (album.album_type === "album") score += 200;

  const year = Number(album.release_date.slice(0, 4));
  if (!Number.isNaN(year)) {
    if (year >= 1960 && year <= 2028) score += 50;
    if (year > 2028) score -= 300;
  }

  return score;
}

function toAlbumResult(album: SpotifyAlbum, searchedArtist?: SpotifyArtist) {
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
    backdropUrl: null,
    languageCode: null,
    externalUrl: album.external_urls?.spotify ?? null,
    artists: album.artists.map((artist) => artist.name),
    primaryArtistName: primaryArtist?.name ?? null,
    totalTracks: album.total_tracks ?? null,
    albumType: album.album_type,
    spotifyPopularity: searchedArtist?.popularity ?? null,
    spotifyArtistFollowers: searchedArtist?.followers?.total ?? null,
    raw: {
      album,
      searchedArtist: searchedArtist ?? null,
    },
  };
}

async function searchByArtist(query: string) {
  const artists = await searchSpotifyArtists(query);

  const bestArtist = artists
    .filter((artist) => artist.id && artist.name)
    .sort((a, b) => getArtistScore(query, b) - getArtistScore(query, a))[0];

  if (!bestArtist) {
    return [];
  }

  const albums = await getSpotifyArtistAlbums(bestArtist.id);
  const seen = new Set<string>();

  return albums
    .filter((album) => album.id && album.name)
    .filter((album) => {
      const key = albumKey(album);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .filter((album) => album.album_type === "album")
    .sort(
      (a, b) =>
        getAlbumScore(query, b, bestArtist) -
        getAlbumScore(query, a, bestArtist)
    )
    .slice(0, 20)
    .map((album) => toAlbumResult(album, bestArtist));
}

async function searchByAlbum(query: string) {
  const albums = await searchSpotifyAlbums(query);
  const seen = new Set<string>();

  return albums
    .filter((album) => album.id && album.name)
    .filter((album) => {
      const key = albumKey(album);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => getAlbumScore(query, b) - getAlbumScore(query, a))
    .slice(0, 20)
    .map((album) => toAlbumResult(album));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q")?.trim();
    const searchBy = normalizeSearchBy(searchParams.get("searchBy"));

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 }
      );
    }

    const results =
      searchBy === "album"
        ? await searchByAlbum(query)
        : await searchByArtist(query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Spotify search error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to search Spotify.",
      },
      { status: 500 }
    );
  }
}