"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

type UserSummary = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  privacy: string;
};

type FriendItem = {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: UserSummary;
};

type IncomingRequest = {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  fromUser: UserSummary;
};

type OutgoingRequest = {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  toUser: UserSummary;
};

type FriendsResponse = {
  friends: FriendItem[];
  incomingRequests: IncomingRequest[];
  outgoingRequests: OutgoingRequest[];
  blocked: FriendItem[];
};

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Response was not valid JSON.",
      raw: text,
    };
  }
}

function UserCard({
  user,
  children,
}: {
  user: UserSummary;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        background: "white",
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 4px" }}>
          {user.displayName || user.username}
          <span style={{ fontWeight: "normal", color: "#555" }}>
            {" "}
            @{user.username}
          </span>
        </h3>

        {user.bio && (
          <p style={{ margin: 0, color: "#555", maxWidth: 520 }}>{user.bio}</p>
        )}

        <div style={{ marginTop: 8 }}>
          <a href={`/profiles/${user.username}`}>View Profile</a>
        </div>
      </div>

      {children && <div>{children}</div>}
    </div>
  );
}

export default function FriendsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [friendState, setFriendState] = useState<FriendsResponse>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    blocked: [],
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCurrentUser() {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (res.ok && data?.user) {
        setCurrentUser(data.user);
        return data.user as CurrentUser;
      }

      setCurrentUser(null);
      return null;
    } catch {
      setCurrentUser(null);
      return null;
    } finally {
      setAuthLoaded(true);
    }
  }

  async function loadFriends(userId: string) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/friends?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to load friends.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setFriendState(data);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Friends request crashed.",
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function initializePage() {
    const user = await loadCurrentUser();

    if (user) {
      await loadFriends(user.id);
    } else {
      setFriendState({
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
        blocked: [],
      });
    }
  }

  useEffect(() => {
    initializePage();
  }, []);

  async function searchUsers() {
    if (!currentUser) {
      setMessage("Please log in before searching for friends.");
      return;
    }

    if (!query.trim()) {
      setMessage("Enter a username or display name.");
      return;
    }

    setLoading(true);
    setMessage("");
    setSearchResults([]);

    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(
          query
        )}&userId=${encodeURIComponent(currentUser.id)}`,
        {
          cache: "no-store",
        }
      );

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "User search failed.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setSearchResults(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "User search crashed.",
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(targetUserId: string) {
    if (!currentUser) {
      setMessage("Please log in before sending friend requests.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          targetUserId,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to send friend request.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setMessage("Friend request sent.");
      await loadFriends(currentUser.id);
      setSearchResults([]);
      setQuery("");
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Send request crashed.",
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(friendshipId: number, action: string) {
    if (!currentUser) {
      setMessage("Please log in before managing friend requests.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          friendshipId,
          action,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: `Failed to ${action} request.`,
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setMessage(`Friend request ${action}ed.`);
      await loadFriends(currentUser.id);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: `${action} request crashed.`,
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeFriendship(friendshipId: number) {
    if (!currentUser) {
      setMessage("Please log in before managing friends.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/friends?userId=${encodeURIComponent(
          currentUser.id
        )}&friendshipId=${friendshipId}`,
        {
          method: "DELETE",
        }
      );

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: "Failed to remove friendship.",
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      setMessage("Friendship removed.");
      await loadFriends(currentUser.id);
    } catch (error) {
      setMessage(
        JSON.stringify(
          {
            error: "Remove friendship crashed.",
            details: String(error),
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const relatedUserIds = new Set<string>([
    ...(currentUser ? [currentUser.id] : []),
    ...friendState.friends.map((item) => item.user.id),
    ...friendState.incomingRequests.map((item) => item.fromUser.id),
    ...friendState.outgoingRequests.map((item) => item.toUser.id),
  ]);

  if (authLoaded && !currentUser) {
    return (
      <main style={{ padding: 40, maxWidth: 900 }}>
        <h1>Friends</h1>

        <div
          style={{
            border: "1px solid #f0b4b4",
            background: "#fff5f5",
            padding: 14,
            borderRadius: 10,
            marginTop: 16,
          }}
        >
          <p style={{ color: "#900", marginTop: 0 }}>
            You are not logged in. Log in or create an account to find friends.
          </p>

          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              border: "1px solid #222",
              borderRadius: 8,
              textDecoration: "none",
              color: "black",
              fontWeight: 700,
              marginRight: 10,
              background: "white",
            }}
          >
            Log In
          </a>

          <a
            href="/signup"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 8,
              textDecoration: "none",
              color: "black",
              fontWeight: 700,
              background: "white",
            }}
          >
            Sign Up
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1>Friends</h1>

      {!authLoaded ? (
        <p style={{ color: "#555" }}>Checking login...</p>
      ) : currentUser ? (
        <p style={{ color: "#555" }}>
          Managing friends as{" "}
          <strong>
            {currentUser.displayName || currentUser.username} (@
            {currentUser.username})
          </strong>
        </p>
      ) : null}

      <p style={{ color: "#555" }}>
        Search users, send friend requests, and manage incoming requests.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2>Find Users</h2>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search username or display name..."
          style={{ padding: 8, width: 320 }}
          disabled={!currentUser}
        />

        <button
          type="button"
          onClick={searchUsers}
          disabled={loading || !currentUser}
          style={{ marginLeft: 10, padding: 8 }}
        >
          {loading ? "Loading..." : "Search"}
        </button>

        <div style={{ marginTop: 16 }}>
          {searchResults.map((user) => {
            const alreadyRelated = relatedUserIds.has(user.id);

            return (
              <UserCard key={user.id} user={user}>
                <button
                  type="button"
                  onClick={() => sendRequest(user.id)}
                  disabled={loading || alreadyRelated}
                >
                  {alreadyRelated ? "Already connected" : "Add Friend"}
                </button>
              </UserCard>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Incoming Requests</h2>

        {friendState.incomingRequests.length === 0 ? (
          <p>No incoming requests.</p>
        ) : (
          friendState.incomingRequests.map((request) => (
            <UserCard key={request.id} user={request.fromUser}>
              <button
                type="button"
                onClick={() => updateRequest(request.id, "accept")}
                disabled={loading}
              >
                Accept
              </button>

              <button
                type="button"
                onClick={() => updateRequest(request.id, "decline")}
                disabled={loading}
                style={{ marginLeft: 8 }}
              >
                Decline
              </button>
            </UserCard>
          ))
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Outgoing Requests</h2>

        {friendState.outgoingRequests.length === 0 ? (
          <p>No outgoing requests.</p>
        ) : (
          friendState.outgoingRequests.map((request) => (
            <UserCard key={request.id} user={request.toUser}>
              <button
                type="button"
                onClick={() => removeFriendship(request.id)}
                disabled={loading}
              >
                Cancel
              </button>
            </UserCard>
          ))
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Friends</h2>

        {friendState.friends.length === 0 ? (
          <p>No friends yet.</p>
        ) : (
          friendState.friends.map((friend) => (
            <UserCard key={friend.id} user={friend.user}>
              <button
                type="button"
                onClick={() => removeFriendship(friend.id)}
                disabled={loading}
              >
                Remove
              </button>
            </UserCard>
          ))
        )}
      </section>

      {message && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {message}
        </pre>
      )}
    </main>
  );
}