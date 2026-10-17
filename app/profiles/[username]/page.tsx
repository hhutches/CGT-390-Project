import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";
import ProfileFriendActions from "./ProfileFriendActions";
import ProfileTopFavorites from "./ProfileTopFavorites";
import ProfileEntriesList from "./ProfileEntriesList";
import ProfileMediaMix from "./ProfileMediaMix";

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
        padding: "7px 11px",
        border: "1px solid #ffd6d4",
        borderRadius: 999,
        background: "#fff2f1",
        color: "#111",
        fontSize: 14,
        fontWeight: 700,
        whiteSpace: "nowrap",
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
  const linkStyle = {
    color: "#d95d59",
    fontWeight: 700,
    textDecoration: "none",
  };

  if (socialInfo.status === "SELF") {
    return (
      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <a href="/add-entry" style={linkStyle}>
          Add Entry
        </a>
        <a href="/favorites" style={linkStyle}>
          Edit Top 4
        </a>
        <a href="/friends" style={linkStyle}>
          Find Friends
        </a>
        <a href="/feed" style={linkStyle}>
          Feed
        </a>
        <a href="/logout" style={linkStyle}>
          Log Out
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <a href="/friends" style={linkStyle}>
        Manage Friends
      </a>
      <a href="/feed" style={linkStyle}>
        Feed
      </a>
      <a href={`/profiles/${profileUsername}`} style={linkStyle}>
        Refresh Profile
      </a>
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
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      <div style={{ color: "#555", fontSize: 14, marginTop: 4 }}>{label}</div>
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
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
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
            background: "#fafafa",
            borderBottom: "1px solid #eee",
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
            <span style={{ fontSize: 12, color: "#666" }}>No cover</span>
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
          height: media.type === "BOOK" ? 240 : 240,
          objectFit: "cover",
          borderRadius: 8,
          flexShrink: 0,
          border: "1px solid #ddd",
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
        border: "1px solid #ddd",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "#eee",
        fontSize: 12,
        color: "#666",
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
      <div
        style={{
          marginBottom: 8,
          fontWeight: 700,
          color: "#d95d59",
        }}
      >
        #{favorite.slotNumber}
      </div>
      <MediaCoverCard media={favorite.media} />
    </a>
  );
}

function EmptyFavoriteSlot({ slotNumber }: { slotNumber: number }) {
  return (
    <div>
      <div
        style={{
          marginBottom: 8,
          fontWeight: 700,
          color: "#d95d59",
        }}
      >
        #{slotNumber}
      </div>
      <div
        style={{
          width: 160,
          height: 240,
          border: "1px dashed #bbb",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
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
        border: "1px solid #ddd",
        padding: 16,
        marginBottom: 16,
        borderRadius: 12,
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        background: "#fff",
      }}
    >
      <a href={`/media/${entry.media.id}`} style={{ textDecoration: "none" }}>
        <MediaCoverCard media={entry.media} />
      </a>

      <div style={{ flex: 1 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>
          <a
            href={`/media/${entry.media.id}`}
            style={{
              color: "#111",
              textDecoration: "none",
            }}
          >
            {entry.media.title}
          </a>
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
              background: "#f7f8fa",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {entry.reviewText}
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <a
            href={`/media/${entry.media.id}`}
            style={{
              color: "#d95d59",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View Media
          </a>
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
    return (
      <main
        style={{
          width: "100%",
          minHeight: "100vh",
          margin: 0,
          boxSizing: "border-box",
          background: "#f7f8fa",
          padding: 40,
        }}
      >
        Profile not found.
      </main>
    );
  }

  const socialInfo = await getSocialInfo(profile.id, currentUser?.id ?? null);
  if(socialInfo.status!=='SELF'){
    if(socialInfo.status==='BLOCKED'||profile.privacy==='PRIVATE'||profile.privacy==='FRIENDS'&&socialInfo.status!=='FRIENDS')return <main style={{padding:40}}>This profile is private or limited to friends.</main>;
    profile.entries=profile.entries.filter(e=>e.visibility==='PUBLIC'||socialInfo.status==='FRIENDS'&&e.visibility==='FRIENDS');
    const visibleIds=new Set(profile.entries.map(e=>e.mediaId));profile.favorites=profile.favorites.filter(f=>visibleIds.has(f.mediaId));
  }


  return (
    <main
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        background: "#f7f8fa",
      }}
    >
      <section
        style={{
          padding: "40px 48px 28px",
          background: "#fff",
          borderBottom: "2px solid #ff7f7a",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 42,
                lineHeight: 1.1,
              }}
            >
              {profile.displayName || profile.username}
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#555",
                fontSize: 16,
              }}
            >
              @{profile.username}
            </p>

            {profile.bio && (
              <p
                style={{
                  color: "#555",
                  maxWidth: 680,
                  lineHeight: 1.5,
                  marginBottom: 0,
                }}
              >
                {profile.bio}
              </p>
            )}
          </div>

          <SocialBadge socialInfo={socialInfo} />
        </div>
      </section>

      <div
        style={{
          padding: "28px 48px 40px",
        }}
      >
        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
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
              <a
                href="/login"
                style={{
                  color: "#d95d59",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Log in
              </a>{" "}
              to add friends.
            </p>
          )}
        </section>

        <section
          style={{
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 430px",
              gap: 28,
              alignItems: "start",
              width: "100%",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 20,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>
                Top 4 Favorites
              </h2>

              <ProfileTopFavorites
                favorites={profile.favorites}
                isOwnProfile={socialInfo.status === "SELF"}
              />
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 20,
              }}
            >
              <ProfileMediaMix entries={profile.entries} />
            </div>
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Entries</h2>

          <ProfileEntriesList
            entries={profile.entries}
            isOwnProfile={socialInfo.status === "SELF"}
          />
        </section>
      </div>
    </main>
  );
}

