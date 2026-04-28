import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";
import ProfileFriendActions from "./ProfileFriendActions";

type Media = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  releaseDate: Date | string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  languageCode: string | null;
  movieDetails?: {
    runtimeMinutes: number | null;
  } | null;
  showDetails?: {
    seasonsCount: number | null;
    episodesCount: number | null;
    avgRuntimeMinutes: number | null;
    showStatus: string | null;
  } | null;
  bookDetails?: {
    pageCount: number | null;
    estimatedReadTimeMinutes: number | null;
    isbn13: string | null;
  } | null;
  albumDetails?: {
    totalTracks: number | null;
    durationSeconds: number | null;
    primaryArtistName: string | null;
  } | null;
  gameDetails?: {
    timeToBeatHours: unknown;
    multiplayer: boolean;
  } | null;
};

type ProfileEntry = {
  id: number;
  status: string;
  ratingValue: number | null;
  reviewText: string | null;
  updatedAt: Date | string;
  media: Media;
};

type ProfileFavorite = {
  userId: string;
  mediaId: number;
  slotNumber: number;
  media: Media;
};

type SocialStatus =
  | "SELF"
  | "FRIENDS"
  | "INCOMING_REQUEST"
  | "OUTGOING_REQUEST"
  | "BLOCKED"
  | "DECLINED"
  | "NONE";

type SocialInfo = {
  status: SocialStatus;
  friendshipId: number | null;
  friendCount: number;
};

async function getProfile(username: string) {
  return prisma.userProfile.findUnique({
    where: {
      username,
    },
    include: {
      favorites: {
        include: {
          media: {
            include: {
              movieDetails: true,
              showDetails: true,
              bookDetails: true,
              albumDetails: true,
              gameDetails: true,
            },
          },
        },
        orderBy: {
          slotNumber: "asc",
        },
      },

      entries: {
        include: {
          media: {
            include: {
              movieDetails: true,
              showDetails: true,
              bookDetails: true,
              albumDetails: true,
              gameDetails: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });
}

async function getSocialInfo(
  profileUserId: string,
  currentUserId: string | null
): Promise<SocialInfo> {
  const friendCount = await prisma.friendship.count({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ userAId: profileUserId }, { userBId: profileUserId }],
    },
  });

  if (!currentUserId) {
    return {
      status: "NONE",
      friendshipId: null,
      friendCount,
    };
  }

  if (profileUserId === currentUserId) {
    return {
      status: "SELF",
      friendshipId: null,
      friendCount,
    };
  }

  const [userAId, userBId] = [currentUserId, profileUserId].sort();

  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: {
        userAId,
        userBId,
      },
    },
  });

  if (!friendship) {
    return {
      status: "NONE",
      friendshipId: null,
      friendCount,
    };
  }

  if (friendship.status === FriendshipStatus.ACCEPTED) {
    return {
      status: "FRIENDS",
      friendshipId: friendship.id,
      friendCount,
    };
  }

  if (friendship.status === FriendshipStatus.PENDING) {
    return {
      status:
        friendship.actionUserId === currentUserId
          ? "OUTGOING_REQUEST"
          : "INCOMING_REQUEST",
      friendshipId: friendship.id,
      friendCount,
    };
  }

  if (friendship.status === FriendshipStatus.BLOCKED) {
    return {
      status: "BLOCKED",
      friendshipId: friendship.id,
      friendCount,
    };
  }

  return {
    status: "DECLINED",
    friendshipId: friendship.id,
    friendCount,
  };
}

function formatYear(value: Date | string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 4);
  }

  return String(date.getFullYear());
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;

  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function SocialBadge({ socialInfo }: { socialInfo: SocialInfo }) {
  const labels: Record<SocialStatus, string> = {
    SELF: "This is your profile",
    FRIENDS: "Friends",
    INCOMING_REQUEST: "Friend request received",
    OUTGOING_REQUEST: "Friend request sent",
    BLOCKED: "Blocked",
    DECLINED: "Request declined",
    NONE: "Not friends",
  };

  return (
    <div
      style={{
        display: "inline-block",
        padding: "6px 10px",
        border: "1px solid var(--app-border)",
        borderRadius: 999,
        background: "#f7f7f7",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {labels[socialInfo.status]}
    </div>
  );
}

function ProfileActions({
  profileUsername,
  socialInfo,
}: {
  profileUsername: string;
  socialInfo: SocialInfo;
}) {
  if (socialInfo.status === "SELF") {
    return (
      <div style={{ marginTop: 16 }}>
        <a href="/add-entry">Add Entry</a>
        {" | "}
        <a href="/favorites">Edit Top 4</a>
        {" | "}
        <a href="/friends">Find Friends</a>
        {" | "}
        <a href="/feed">Feed</a>
        {" | "}
        <a href="/logout">Log Out</a>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <a href="/friends">Manage Friends</a>
      {" | "}
      <a href="/feed">Feed</a>
      {" | "}
      <a href={`/profiles/${profileUsername}`}>Refresh Profile</a>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--app-surface-strong)",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      <div style={{ color: "#555", fontSize: 14 }}>{label}</div>
    </div>
  );
}

function MediaCoverCard({ media }: { media: Media }) {
  if (media.type === "ALBUM") {
    return (
      <div
        style={{
          width: 160,
          height: 240,
          border: "1px solid var(--app-border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--app-surface-strong)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 40,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 600,
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
            width: 160,
            height: 160,
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
              alt={media.title}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span style={{ fontSize: 12 }}>No cover</span>
          )}
        </div>

        <div
          style={{
            height: 40,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 700,
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
        alt={media.title}
        loading="lazy"
        decoding="async"
        style={{
          width: 160,
          height: 240,
          objectFit: "cover",
          borderRadius: 8,
          flexShrink: 0,
          border: "1px solid var(--app-border)",
          background: "#eee",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 160,
        height: 240,
        border: "1px solid var(--app-border)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "#eee",
        fontSize: 12,
      }}
    >
      No cover
    </div>
  );
}

function MediaMeta({ media }: { media: Media }) {
  const year = formatYear(media.releaseDate);

  return (
    <div style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
      <span>{media.type}</span>

      {year && <span> · {year}</span>}

      {media.type === "MOVIE" && media.movieDetails?.runtimeMinutes && (
        <span> · {media.movieDetails.runtimeMinutes} min</span>
      )}

      {media.type === "SHOW" && media.showDetails?.seasonsCount && (
        <span> · {media.showDetails.seasonsCount} seasons</span>
      )}

      {media.type === "BOOK" && media.bookDetails?.pageCount && (
        <span> · {media.bookDetails.pageCount} pages</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.primaryArtistName && (
        <span> · {media.albumDetails.primaryArtistName}</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.totalTracks && (
        <span> · {media.albumDetails.totalTracks} tracks</span>
      )}

      {media.type === "ALBUM" && media.albumDetails?.durationSeconds && (
        <span> · {formatDuration(media.albumDetails.durationSeconds)}</span>
      )}

      {media.type === "GAME" && media.gameDetails?.multiplayer !== undefined && (
        <span>
          {" "}
          · {media.gameDetails.multiplayer ? "Multiplayer" : "Single-player"}
        </span>
      )}
    </div>
  );
}

function FavoriteSlot({ favorite }: { favorite: ProfileFavorite }) {
  return (
    <a
      href={`/media/${favorite.media.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 700 }}>
        #{favorite.slotNumber}
      </div>
      <MediaCoverCard media={favorite.media} />
    </a>
  );
}

function EmptyFavoriteSlot({ slotNumber }: { slotNumber: number }) {
  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 700 }}>#{slotNumber}</div>
      <div
        style={{
          width: 160,
          height: 240,
          border: "1px dashed #bbb",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f7",
          color: "#777",
          fontSize: 13,
        }}
      >
        Empty
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: ProfileEntry }) {
  return (
    <article
      style={{
        border: "1px solid var(--app-border)",
        padding: 16,
        marginBottom: 16,
        borderRadius: 12,
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        background: "var(--app-surface-strong)",
      }}
    >
      <a href={`/media/${entry.media.id}`} style={{ textDecoration: "none" }}>
        <MediaCoverCard media={entry.media} />
      </a>

      <div style={{ flex: 1 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>
          <a href={`/media/${entry.media.id}`}>{entry.media.title}</a>
        </h3>

        <MediaMeta media={entry.media} />

        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Status: <strong>{entry.status}</strong>
        </p>

        {entry.ratingValue !== null && (
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            Rating: <strong>{entry.ratingValue}/10</strong>
          </p>
        )}

        {entry.reviewText && (
          <p
            style={{
              marginTop: 12,
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
            }}
          >
            {entry.reviewText}
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <a href={`/media/${entry.media.id}`}>View Media</a>
        </div>
      </div>
    </article>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  const currentUser = await getCurrentUser();

  if (!profile) {
    return <main style={{ padding: 40 }}>Profile not found.</main>;
  }

  const socialInfo = await getSocialInfo(profile.id, currentUser?.id ?? null);

  const favoriteSlots = [1, 2, 3, 4].map((slotNumber) => {
    const favorite = profile.favorites.find(
      (item) => item.slotNumber === slotNumber
    );

    return {
      slotNumber,
      favorite,
    };
  });

  return (
    <main style={{ padding: "36px clamp(20px, 4vw, 64px)", width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1 style={{ marginBottom: 8 }}>
              {profile.displayName || profile.username} (@{profile.username})
            </h1>

            {profile.bio && (
              <p style={{ color: "#555", maxWidth: 680 }}>{profile.bio}</p>
            )}
          </div>

          <SocialBadge socialInfo={socialInfo} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 22,
            maxWidth: 720,
          }}
        >
          <StatCard label="entries" value={profile.entries.length} />
          <StatCard label="friends" value={socialInfo.friendCount} />
          <StatCard label="top 4 filled" value={profile.favorites.length} />
          <StatCard label="username" value={`@${profile.username}`} />
        </div>

        <ProfileActions
          profileUsername={profile.username}
          socialInfo={socialInfo}
        />

        {currentUser ? (
          <ProfileFriendActions
            currentUserId={currentUser.id}
            profileUserId={profile.id}
            friendshipId={socialInfo.friendshipId}
            initialStatus={socialInfo.status}
          />
        ) : (
          <p style={{ marginTop: 16 }}>
            <a href="/login">Log in</a> to add friends.
          </p>
        )}
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2>Top 4 Favorites</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 16,
            alignItems: "start",
          }}
        >
          {favoriteSlots.map(({ slotNumber, favorite }) =>
            favorite ? (
              <FavoriteSlot key={slotNumber} favorite={favorite} />
            ) : (
              <EmptyFavoriteSlot key={slotNumber} slotNumber={slotNumber} />
            )
          )}
        </div>
      </section>

      <section>
        <h2>Entries</h2>

        {profile.entries.length === 0 ? (
          <p>No entries yet.</p>
        ) : (
          <div>
            {profile.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}