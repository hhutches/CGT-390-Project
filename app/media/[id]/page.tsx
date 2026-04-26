import { getMediaById } from "@/lib/media";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function getYear(date: Date | string | null) {
  if (!date) return null;
  return new Date(date).getFullYear();
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

  const ratings = media.entries
    .map((entry) => entry.ratingValue)
    .filter((rating): rating is number => rating !== null);

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null;

  const releaseYear = getYear(media.releaseDate);

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

          <h1 style={{ marginBottom: 8 }}>
            {media.title}
            {releaseYear && <span> ({releaseYear})</span>}
          </h1>

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
                {media.genres.map((item) => item.genre.name).join(", ")}
              </p>
            )}

            {media.externalRefs.length > 0 && (
              <p>
                <strong>External source:</strong>{" "}
                {media.externalRefs.map((ref) => ref.provider).join(", ")}
              </p>
            )}

            {media.externalRefs.length > 0 && (
              <p>
                <strong>External links:</strong>{" "}
                {media.externalRefs
                  .filter((ref) => ref.externalUrl)
                  .map((ref, index) => (
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

      <section style={{ marginTop: 30 }}>
        <h2>Reviews</h2>

        {media.entries.length === 0 ? (
          <p>No one has logged this yet.</p>
        ) : (
          media.entries.map((entry) => (
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