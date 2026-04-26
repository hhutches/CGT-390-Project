type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

type SpotifyArtist = {
  id: string;
  name: string;
  popularity: number;
  followers?: {
    total: number;
  };
  genres?: string[];
  images?: SpotifyImage[];
  external_urls?: {
    spotify?: string;
  };
};

type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  popularity?: number;
  images?: SpotifyImage[];
  artists: SpotifyArtist[];
  external_urls?: {
    spotify?: string;
  };
};

type SpotifyArtistSearchResponse = {
  artists?: {
    items?: SpotifyArtist[];
  };
};

type SpotifyAlbumSearchResponse = {
  albums?: {
    items?: SpotifyAlbum[];
  };
};

type SpotifyArtistAlbumsResponse = {
  items?: SpotifyAlbum[];
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing.");
  }

  return { clientId, clientSecret };
}

async function getSpotifyAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getSpotifyCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Spotify token request failed: ${response.status}${
        body ? ` - ${body}` : ""
      }`
    );
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

async function spotifyFetch<T>(path: string, params: Record<string, string>) {
  const token = await getSpotifyAccessToken();

  const url = new URL(`https://api.spotify.com/v1/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Spotify request failed: ${response.status}${
        body ? ` - ${body}` : ""
      }`
    );
  }

  return response.json() as Promise<T>;
}

export function normalizeSpotifyText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getBestSpotifyImage(images?: SpotifyImage[]) {
  if (!images || images.length === 0) return null;

  return (
    [...images].sort((a, b) => {
      const aSize = (a.width || 0) * (a.height || 0);
      const bSize = (b.width || 0) * (b.height || 0);

      return bSize - aSize;
    })[0]?.url ?? null
  );
}

export async function searchSpotifyArtists(query: string) {
  const data = await spotifyFetch<SpotifyArtistSearchResponse>("search", {
    q: query,
    type: "artist",
    limit: "10",
  });

  return data.artists?.items ?? [];
}

export async function searchSpotifyAlbums(query: string) {
  const data = await spotifyFetch<SpotifyAlbumSearchResponse>("search", {
    q: query,
    type: "album",
    limit: "10",
  });

  return data.albums?.items ?? [];
}

export async function getSpotifyArtistAlbums(artistId: string) {
  const data = await spotifyFetch<SpotifyArtistAlbumsResponse>(
    `artists/${artistId}/albums`,
    {
      include_groups: "album",
      limit: "10",
    }
  );

  return data.items ?? [];
}

export type { SpotifyArtist, SpotifyAlbum };