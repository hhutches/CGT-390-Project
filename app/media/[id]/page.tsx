import MediaActions from "@/app/components/MediaActions";
import { getMediaById } from "@/lib/media";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type TmdbPerson = {
  id: number | string;
  name: string;
  role: string;
  imageUrl: string | null;
};

type TmdbExtras = {
  trailer: {
    key: string;
    name: string;
    url: string;
  } | null;
  logoUrl: string | null;
  directors: TmdbPerson[];
  cast: TmdbPerson[];
};

function getEmptyTmdbExtras(): TmdbExtras {
  return {
    trailer: null,
    logoUrl: null,
    directors: [],
    cast: [],
  };
}

function getYear(date: Date | string | null) {
  if (!date) return null;

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getFullYear();
}

function formatRating(value: number | null) {
  if (value === null) return "No rating";
  return `${value}/10`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "Unknown";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function tmdbOriginalImage(path: string | null | undefined) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/original${path}`;
}

function MediaCoverDisplay({ media }: { media: any }) {
  if (media.type === "ALBUM") {
    return (
      <div
        style={{
          width: 220,
          height: 330,
          border: "1px solid #ccc",
          borderRadius: 10,
          overflow: "hidden",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 55,
            padding: "8px 10px",
            fontSize: 16,
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
          }}
        >
          {media.albumDetails?.primaryArtistName ?? "Unknown Artist"}
        </div>

        <div
          style={{
            width: 220,
            height: 220,
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {media.coverUrl ? (
            <img
              src={media.coverUrl}
              alt={`${media.title} cover`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span style={{ fontSize: 13 }}>No cover</span>
          )}
        </div>

        <div
          style={{
            height: 55,
            padding: "8px 10px",
            fontSize: 16,
            fontWeight: 800,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
          }}
        >
          {media.title}
        </div>
      </div>
    );
  }

  if (media.coverUrl) {
    return (
      <img
        src={media.coverUrl}
        alt={`${media.title} cover`}
        style={{
          width: 220,
          borderRadius: 10,
          border: "1px solid #ccc",
          background: "#eee",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 220,
        height: 330,
        border: "1px solid #ccc",
        borderRadius: 10,
        background: "#eee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
      }}
    >
      No cover
    </div>
  );
}

function getTmdbExternalRef(media: any) {
  return media.externalRefs?.find((ref: any) => {
    const provider = String(ref.provider).toUpperCase();
    return provider === "TMDB";
  });
}

async function getTmdbExtras(media: any): Promise<TmdbExtras> {
  const tmdbRef = getTmdbExternalRef(media);

  if (!tmdbRef || (media.type !== "MOVIE" && media.type !== "SHOW")) {
    return getEmptyTmdbExtras();
  }

  const token = process.env.TMDB_ACCESS_TOKEN;

  if (!token) {
    return getEmptyTmdbExtras();
  }

  const kind = media.type === "SHOW" ? "tv" : "movie";
  const tmdbId = tmdbRef.externalId;

  async function tmdbFetch(path: string) {
    const res = await fetch(`https://api.themoviedb.org/3/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      next: {
        revalidate: 86400,
      },
    });

    if (!res.ok) return null;

    return res.json();
  }

  const [videos, credits, images] = await Promise.all([
    tmdbFetch(`${kind}/${tmdbId}/videos?language=en-US`),
    tmdbFetch(`${kind}/${tmdbId}/credits?language=en-US`),
    tmdbFetch(`${kind}/${tmdbId}/images?include_image_language=en,null`),
  ]);

  const trailer =
    videos?.results?.find(
      (video: any) =>
        video.site === "YouTube" &&
        video.type === "Trailer" &&
        video.official
    ) ||
    videos?.results?.find(
      (video: any) => video.site === "YouTube" && video.type === "Trailer"
    ) ||
    videos?.results?.find((video: any) => video.site === "YouTube") ||
    null;

  const logo =
    images?.logos?.find(
      (item: any) => item.iso_639_1 === "en" && item.file_path
    ) ||
    images?.logos?.find(
      (item: any) => item.iso_639_1 === null && item.file_path
    ) ||
    images?.logos?.find((item: any) => item.file_path) ||
    null;

  const logoUrl = tmdbOriginalImage(logo?.file_path);

  const directors =
    credits?.crew
      ?.filter((person: any) => {
        const job = String(person.job || "").toLowerCase();
        const department = String(person.department || "").toLowerCase();

        return (
          job === "director" ||
          job === "creator" ||
          department === "directing"
        );
      })
      .map((person: any) => ({
        id: person.id,
        name: person.name,
        role: person.job || "Director",
        imageUrl: person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : null,
      })) ?? [];

  const cast =
    credits?.cast
      ?.sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, 18)
      .map((person: any) => ({
        id: person.id,
        name: person.name,
        role: person.character || "Cast",
        imageUrl: person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : null,
      })) ?? [];

  return {
    trailer: trailer?.key
      ? {
          key: trailer.key,
          name: trailer.name || "Trailer",
          url: `https://www.youtube.com/embed/${trailer.key}`,
        }
      : null,
    logoUrl,
    directors,
    cast,
  };
}

function PersonScroller({
  title,
  people,
}: {
  title: string;
  people: TmdbPerson[];
}) {
  if (people.length === 0) return null;

  return (
    <section style={{ marginTop: 30 }}>
      <h2>{title}</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 12,
        }}
      >
        {people.map((person) => (
          <div
            key={`${person.id}-${person.role}`}
            style={{
              width: 130,
              flex: "0 0 auto",
              border: "1px solid #ccc",
              borderRadius: 10,
              padding: 10,
              background: "white",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 160,
                borderRadius: 8,
                background: "#eee",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              {person.imageUrl ? (
                <img
                  src={person.imageUrl}
                  alt={person.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                "No image"
              )}
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 8,
                fontSize: 14,
                lineHeight: 1.2,
              }}
            >
              {person.name}
            </strong>

            {person.role && (
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 12,
                  color: "#666",
                  lineHeight: 1.2,
                }}
              >
                {person.role}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function MediaPage({ params }: Props) {
  const { id } = await params;
  const mediaId = Number(id);

  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    notFound();
  }

  const media = await getMediaById(mediaId);

  if (!media) {
    notFound();
  }

  const tmdbExtras = await getTmdbExtras(media);

  const ratings = media.entries
    .map((entry: any) => entry.ratingValue)
    .filter((rating: number | null): rating is number => rating !== null);

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) /
        ratings.length
      : null;

  const releaseYear = getYear(media.releaseDate);
  const isTmdbVisualMedia = media.type === "MOVIE" || media.type === "SHOW";

  return (
    <main style={{ padding: 40, maxWidth: 1000 }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 30,
          alignItems: "start",
        }}
      >
        <MediaCoverDisplay media={media} />

        <div>
          <p style={{ margin: 0, textTransform: "uppercase", opacity: 0.7 }}>
            {media.type}
          </p>

          {isTmdbVisualMedia && tmdbExtras.logoUrl ? (
            <div style={{ margin: "10px 0 16px" }}>
              <img
                src={tmdbExtras.logoUrl}
                alt={media.title}
                style={{
                  display: "block",
                  maxWidth: 430,
                  maxHeight: 155,
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />

              {releaseYear ? (
                <p
                  style={{
                    margin: "10px 0 0",
                    fontWeight: 800,
                    color: "#333",
                  }}
                >
                  {releaseYear}
                </p>
              ) : null}
            </div>
          ) : (
            <h1 style={{ marginBottom: 8 }}>
              {media.title}
              {releaseYear && <span> ({releaseYear})</span>}
            </h1>
          )}

          {media.originalTitle && media.originalTitle !== media.title && (
            <p>
              <strong>Original title:</strong> {media.originalTitle}
            </p>
          )}

          {media.description && (
            <p style={{ lineHeight: 1.5 }}>{media.description}</p>
          )}

          <div style={{ marginTop: 20 }}>
            <h2>Details</h2>

            {media.movieDetails && (
              <p>
                <strong>Runtime:</strong>{" "}
                {media.movieDetails.runtimeMinutes ?? "Unknown"} minutes
              </p>
            )}

            {media.showDetails && (
              <>
                <p>
                  <strong>Seasons:</strong>{" "}
                  {media.showDetails.seasonsCount ?? "Unknown"}
                </p>
                <p>
                  <strong>Episodes:</strong>{" "}
                  {media.showDetails.episodesCount ?? "Unknown"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {media.showDetails.showStatus ?? "Unknown"}
                </p>
              </>
            )}

            {media.bookDetails && (
              <>
                <p>
                  <strong>Pages:</strong>{" "}
                  {media.bookDetails.pageCount ?? "Unknown"}
                </p>
                <p>
                  <strong>Estimated read time:</strong>{" "}
                  {media.bookDetails.estimatedReadTimeMinutes
                    ? `${media.bookDetails.estimatedReadTimeMinutes} minutes`
                    : "Unknown"}
                </p>
                <p>
                  <strong>ISBN-13:</strong>{" "}
                  {media.bookDetails.isbn13 ?? "Unknown"}
                </p>
              </>
            )}

            {media.albumDetails && (
              <>
                <p>
                  <strong>Primary artist:</strong>{" "}
                  {media.albumDetails.primaryArtistName ?? "Unknown"}
                </p>
                <p>
                  <strong>Tracks:</strong>{" "}
                  {media.albumDetails.totalTracks ?? "Unknown"}
                </p>
                <p>
                  <strong>Duration:</strong>{" "}
                  {formatDuration(media.albumDetails.durationSeconds)}
                </p>
              </>
            )}

            {media.gameDetails && (
              <>
                <p>
                  <strong>Time to beat:</strong>{" "}
                  {media.gameDetails.timeToBeatHours
                    ? `${media.gameDetails.timeToBeatHours} hours`
                    : "Unknown"}
                </p>
                <p>
                  <strong>Multiplayer:</strong>{" "}
                  {media.gameDetails.multiplayer ? "Yes" : "No"}
                </p>
              </>
            )}

            {media.genres.length > 0 && (
              <p>
                <strong>Genres:</strong>{" "}
                {media.genres.map((item: any) => item.genre.name).join(", ")}
              </p>
            )}

            {media.externalRefs.length > 0 && (
              <p>
                <strong>External source:</strong>{" "}
                {media.externalRefs.map((ref: any) => ref.provider).join(", ")}
              </p>
            )}

            {media.externalRefs.length > 0 && (
              <p>
                <strong>External links:</strong>{" "}
                {media.externalRefs
                  .filter((ref: any) => ref.externalUrl)
                  .map((ref: any, index: number) => (
                    <span key={ref.id}>
                      {index > 0 && ", "}
                      <a
                        href={ref.externalUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ref.provider}
                      </a>
                    </span>
                  ))}
              </p>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <MediaActions
          mediaId={String(media.id)}
          mediaType={media.type}
          existingEntry={null}
        />
      </section>

      {isTmdbVisualMedia && (
        <section style={{ marginTop: 40 }}>
          <h2>Trailer</h2>

          {tmdbExtras.trailer ? (
            <div
              style={{
                aspectRatio: "16 / 9",
                width: "100%",
                maxWidth: 900,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #ccc",
                background: "black",
              }}
            >
              <iframe
                src={tmdbExtras.trailer.url}
                title={tmdbExtras.trailer.name}
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </div>
          ) : (
            <p>No trailer available.</p>
          )}
        </section>
      )}

      <hr style={{ margin: "40px 0" }} />

      <section>
        <h2>Community Ratings</h2>

        <p>
          <strong>Average rating:</strong>{" "}
          {averageRating === null
            ? "No ratings yet"
            : `${averageRating.toFixed(1)}/10`}
        </p>

        <p>
          <strong>Total entries:</strong> {media.entries.length}
        </p>
      </section>

      {isTmdbVisualMedia && (
        <>
          <PersonScroller
            title="Director / Creator"
            people={tmdbExtras.directors}
          />

          <PersonScroller title="Main Cast" people={tmdbExtras.cast} />
        </>
      )}

      <section style={{ marginTop: 30 }}>
        <h2>Reviews</h2>

        {media.entries.length === 0 ? (
          <p>No one has logged this yet.</p>
        ) : (
          media.entries.map((entry: any) => (
            <article
              key={entry.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {entry.user.displayName ?? entry.user.username}
                <span style={{ fontWeight: "normal" }}>
                  {" "}
                  (@{entry.user.username})
                </span>
              </h3>

              <p>
                <strong>Status:</strong> {entry.status}
              </p>

              <p>
                <strong>Rating:</strong> {formatRating(entry.ratingValue)}
              </p>

              {entry.reviewText ? (
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                  {entry.reviewText}
                </p>
              ) : (
                <p style={{ opacity: 0.7 }}>No written review.</p>
              )}

              <p style={{ fontSize: 13, opacity: 0.7 }}>
                Updated {new Date(entry.updatedAt).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}