const MUSICBRAINZ_API_ROOT = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_ROOT = "https://coverartarchive.org";

let lastMusicBrainzRequestAt = 0;
let lastCoverArtRequestAt = 0;

function getMusicBrainzUserAgent() {
  const userAgent = process.env.MUSICBRAINZ_USER_AGENT;

  if (!userAgent) {
    throw new Error(
      "Missing MUSICBRAINZ_USER_AGENT. Add MUSICBRAINZ_USER_AGENT to .env."
    );
  }

  return userAgent;
}

async function waitForRateLimit(lastRequestAt: number) {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  const minimumGapMs = 1100;

  if (elapsed < minimumGapMs) {
    await new Promise((resolve) =>
      setTimeout(resolve, minimumGapMs - elapsed)
    );
  }

  return Date.now();
}

function secureUrl(url?: string | null) {
  if (!url) return null;
  return url.replace("http://", "https://");
}

export async function musicBrainzFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {}
): Promise<T> {
  lastMusicBrainzRequestAt = await waitForRateLimit(lastMusicBrainzRequestAt);

  const url = new URL(`${MUSICBRAINZ_API_ROOT}${path}`);

  url.searchParams.set("fmt", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": getMusicBrainzUserAgent(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `MusicBrainz request failed: ${response.status} ${response.statusText}${
        text ? ` - ${text.slice(0, 500)}` : ""
      }`
    );
  }

  return response.json() as Promise<T>;
}

export async function coverArtArchiveFetch<T>(path: string): Promise<T | null> {
  lastCoverArtRequestAt = await waitForRateLimit(lastCoverArtRequestAt);

  const url = `${COVER_ART_ARCHIVE_ROOT}${path}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": getMusicBrainzUserAgent(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<T>;
}

export async function getCoverArtArchiveReleaseGroupImage(
  releaseGroupId: string
): Promise<string | null> {
  const data = await coverArtArchiveFetch<{
    images?: Array<{
      image?: string;
      front?: boolean;
      thumbnails?: Record<string, string>;
    }>;
  }>(`/release-group/${encodeURIComponent(releaseGroupId)}`);

  const images = Array.isArray(data?.images) ? data.images : [];

  const frontImage =
    images.find((image) => image.front === true) ?? images[0] ?? null;

  if (!frontImage) {
    return null;
  }

  const coverUrl =
    frontImage.thumbnails?.large ??
    frontImage.thumbnails?.["500"] ??
    frontImage.thumbnails?.["250"] ??
    frontImage.thumbnails?.small ??
    frontImage.image ??
    null;

  return secureUrl(coverUrl);
}

export function getMusicBrainzExternalUrl(entity: string, mbid: string) {
  return `https://musicbrainz.org/${entity}/${mbid}`;
}