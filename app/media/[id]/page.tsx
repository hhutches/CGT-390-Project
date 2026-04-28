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
          width: 280,
          height: 420,
          border: "1px solid var(--app-border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--app-surface-strong)",
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
            width: 280,
            height: 280,
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
          width: "100%",
          maxWidth: 420,
          aspectRatio: "2 / 3",
          height: "auto",
          objectFit: "cover",
          borderRadius: 18,
          border: "1px solid var(--app-border, #ccc)",
          background: "#eee",
          boxShadow: "0 24px 70px rgba(0,0,0,0.14)",
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 280,
        height: 420,
        border: "1px solid var(--app-border)",
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

function MediaInfoRow({ media }: { media: any }) {
  const items: string[] = [];

  if (media.movieDetails?.runtimeMinutes) {
    items.push(`${media.movieDetails.runtimeMinutes} min`);
  }

  if (media.showDetails?.seasonsCount) {
    items.push(`Seasons: ${media.showDetails.seasonsCount}`);
  }

  if (media.showDetails?.episodesCount) {
    items.push(`Episodes: ${media.showDetails.episodesCount}`);
  }

  if (media.showDetails?.showStatus) {
    items.push(media.showDetails.showStatus);
  }

  if (media.bookDetails?.pageCount) {
    items.push(`${media.bookDetails.pageCount} pages`);
  }

  if (media.albumDetails?.primaryArtistName) {
    items.push(media.albumDetails.primaryArtistName);
  }

  if (media.albumDetails?.totalTracks) {
    items.push(`${media.albumDetails.totalTracks} tracks`);
  }

  if (media.gameDetails?.timeToBeatHours) {
    items.push(`${media.gameDetails.timeToBeatHours} hrs`);
  }

  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        flexWrap: "wrap",
        alignItems: "center",
        margin: "10px 0 10px",
        fontSize: 15,
      }}
    >
      {items.map((item) => (
        <strong key={item}>{item}</strong>
      ))}
    </div>
  );
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
    <section style={{ marginTop: 30, width: "100%", maxWidth: "none" }}>
      <h2>{title}</h2>

      <div
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          width: "100%",
          maxWidth: "100%",
          paddingBottom: 12,
        }}
      >
        {people.map((person) => (
          <div
            key={`${person.id}-${person.role}`}
            style={{
              width: 118,
              flex: "0 0 auto",
              border: "1px solid var(--app-border)",
              borderRadius: 10,
              padding: 10,
              background: "var(--app-surface-strong)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 132,
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
                fontSize: 12,
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
                  fontSize: 11,
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
  const director =
    tmdbExtras.directors.find((person) =>
      String(person.role || "").toLowerCase().includes("director")
    ) ?? tmdbExtras.directors[0] ?? null;
  const castAndCrew = [
    ...(director ? [director] : []),
    ...tmdbExtras.cast.filter((person) => person.id !== director?.id),
  ];

  return (
    <main style={{ padding: "36px clamp(20px, 4vw, 64px)", width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "clamp(300px, 28vw, 420px) minmax(0, 1fr)",
          gap: 44,
          alignItems: "start",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "start",
          }}
        >
          <MediaCoverDisplay media={media} />
        </div>

        <div
          style={{
            minWidth: 0,
            width: "100%",
            maxWidth: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            paddingTop: 18,
          }}
        >
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              opacity: 0.7,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {media.type}
          </p>

          {isTmdbVisualMedia && tmdbExtras.logoUrl ? (
            <div style={{ margin: "14px 0 18px" }}>
              <img
                src={tmdbExtras.logoUrl}
                alt={media.title}
                style={{
                  display: "block",
                  width: "min(100%, 560px)",
                  maxHeight: 150,
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />
            </div>
          ) : (
            <h1
              style={{
                margin: "10px 0 12px",
                fontSize: 52,
                lineHeight: 0.95,
                letterSpacing: "-0.055em",
              }}
            >
              {media.title}
              {releaseYear && <span> ({releaseYear})</span>}
            </h1>
          )}

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.05,
                  letterSpacing: "-0.035em",
                }}
              >
                {releaseYear ? `${media.title} (${releaseYear})` : media.title}
              </h2>

              <MediaInfoRow media={media} />
            </div>

            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 10,
                fontSize: 14,
              }}
            >
              <span>
                <strong>Average rating:</strong>{" "}
                {averageRating === null
                  ? "No ratings yet"
                  : `${averageRating.toFixed(1)}/10`}
              </span>

              <span>
                <strong>Total entries:</strong> {media.entries.length}
              </span>
            </div>

            {media.originalTitle && media.originalTitle !== media.title ? (
              <p style={{ marginBottom: 8 }}>
                <strong>Original title:</strong> {media.originalTitle}
              </p>
            ) : null}

            {media.description ? (
              <p
                style={{
                  lineHeight: 1.48,
                  fontSize: 19,
                  margin: "14px 0 0",
                  maxWidth: 920,
                }}
              >
                {media.description}
              </p>
            ) : null}
          </div>



          {!isTmdbVisualMedia ? (
            <div style={{ marginTop: 22 }}>
              {media.genres.length > 0 && (
                <p>
                  <strong>Genres:</strong>{" "}
                  {media.genres.map((item: any) => item.genre.name).join(", ")}
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
          ) : null}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "clamp(300px, 28vw, 420px) minmax(0, 1fr)",
          gap: 44,
          alignItems: "start",
          width: "100%",
          marginTop: 18,
        }}
      >
        <div aria-hidden="true" />

        <div style={{ width: "100%", maxWidth: "none" }}>
          <MediaActions
            mediaId={String(media.id)}
            mediaType={media.type}
            existingEntry={null}
          />
        </div>
      </section>

      {isTmdbVisualMedia && castAndCrew.length > 0 ? (
        <section
          style={{
            marginTop: 28,
            width: "100%",
            maxWidth: "none",
          }}
        >
          <PersonScroller title="Cast & Crew" people={castAndCrew} />
        </section>
      ) : null}

      {isTmdbVisualMedia && (
        <section style={{ marginTop: 40 }}>
          <h2>Trailer</h2>

          {tmdbExtras.trailer ? (
            <div
              style={{
                aspectRatio: "16 / 9",
                width: "100%",
                maxWidth: 920,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--app-border)",
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



      <section style={{ marginTop: 30, width: "100%", maxWidth: "none" }}>
        <h2>Reviews</h2>

        {media.entries.length === 0 ? (
          <p>No one has logged this yet.</p>
        ) : (
          media.entries.map((entry: any) => (
            <article
              key={entry.id}
              style={{
                border: "1px solid var(--app-border)",
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