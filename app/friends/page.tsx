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
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: "#fff",
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: 18,
          }}
        >
          {user.displayName || user.username}
          <span
            style={{
              fontWeight: "normal",
              color: "#555",
              fontSize: 15,
            }}
          >
            {" "}
            @{user.username}
          </span>
        </h3>

        {user.bio && (
          <p
            style={{
              margin: 0,
              color: "#555",
              maxWidth: 520,
              lineHeight: 1.4,
            }}
          >
            {user.bio}
          </p>
        )}

        <div style={{ marginTop: 8 }}>
          <a
            href={`/profiles/${user.username}`}
            style={{
              color: "#d95d59",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            View Profile
          </a>
        </div>
      </div>

      {children && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {children}
        </div>
      )}
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
          <h1
            style={{
              margin: 0,
              fontSize: 42,
            }}
          >
            Friends
          </h1>

          <p
            style={{
              color: "#555",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Log in or create an account to find friends and manage friend
            requests.
          </p>
        </section>

        <section
          style={{
            margin: "28px 48px",
            padding: 24,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
          }}
        >
          <p
            style={{
              color: "#555",
              marginTop: 0,
              lineHeight: 1.5,
            }}
          >
            You are not logged in. Log in or create an account to find friends.
          </p>

          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              border: "1px solid #ff7f7a",
              borderRadius: 8,
              textDecoration: "none",
              color: "white",
              fontWeight: 700,
              marginRight: 10,
              background: "#ff7f7a",
            }}
          >
            Log In
          </a>

          <a
            href="/signup"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              border: "1px solid #ffd6d4",
              borderRadius: 8,
              textDecoration: "none",
              color: "#111",
              fontWeight: 700,
              background: "#ffe2df",
            }}
          >
            Sign Up
          </a>
        </section>
      </main>
    );
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
        <h1
          style={{
            margin: 0,
            fontSize: 42,
          }}
        >
          Friends
        </h1>

        {!authLoaded ? (
          <p style={{ color: "#555", marginTop: 10 }}>Checking login...</p>
        ) : currentUser ? (
          <p
            style={{
              color: "#555",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Managing friends as{" "}
            <strong>
              {currentUser.displayName || currentUser.username} (@
              {currentUser.username})
            </strong>
          </p>
        ) : null}

        <p
          style={{
            color: "#555",
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Search users, send friend requests, and manage incoming requests.
        </p>
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
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Find Users</h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              searchUsers();
            }}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username or display name..."
              style={{
                padding: 10,
                width: 340,
                maxWidth: "100%",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
              }}
              disabled={!currentUser}
            />

            <button
              type="submit"
              disabled={loading || !currentUser}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ff7f7a",
                background: loading || !currentUser ? "#f0b7b3" : "#ff7f7a",
                color: "white",
                fontWeight: 700,
                cursor: loading || !currentUser ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </form>

          <div style={{ marginTop: 18 }}>
            {searchResults.map((user) => {
              const alreadyRelated = relatedUserIds.has(user.id);

              return (
                <UserCard key={user.id} user={user}>
                  <button
                    type="button"
                    onClick={() => sendRequest(user.id)}
                    disabled={loading || alreadyRelated}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: alreadyRelated
                        ? "1px solid #ddd"
                        : "1px solid #ff7f7a",
                      background: alreadyRelated ? "#eee" : "#ff7f7a",
                      color: alreadyRelated ? "#666" : "white",
                      fontWeight: 700,
                      cursor:
                        loading || alreadyRelated ? "not-allowed" : "pointer",
                    }}
                  >
                    {alreadyRelated ? "Already connected" : "Add Friend"}
                  </button>
                </UserCard>
              );
            })}
          </div>
        </section>

        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>
            Incoming Requests
          </h2>

          {friendState.incomingRequests.length === 0 ? (
            <p style={{ color: "#777", marginBottom: 0 }}>
              No incoming requests.
            </p>
          ) : (
            friendState.incomingRequests.map((request) => (
              <UserCard key={request.id} user={request.fromUser}>
                <button
                  type="button"
                  onClick={() => updateRequest(request.id, "accept")}
                  disabled={loading}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ff7f7a",
                    background: "#ff7f7a",
                    color: "white",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() => updateRequest(request.id, "decline")}
                  disabled={loading}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Decline
                </button>
              </UserCard>
            ))
          )}
        </section>

        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>
            Outgoing Requests
          </h2>

          {friendState.outgoingRequests.length === 0 ? (
            <p style={{ color: "#777", marginBottom: 0 }}>
              No outgoing requests.
            </p>
          ) : (
            friendState.outgoingRequests.map((request) => (
              <UserCard key={request.id} user={request.toUser}>
                <button
                  type="button"
                  onClick={() => removeFriendship(request.id)}
                  disabled={loading}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
              </UserCard>
            ))
          )}
        </section>

        <section
          style={{
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Friends</h2>

          {friendState.friends.length === 0 ? (
            <p style={{ color: "#777", marginBottom: 0 }}>No friends yet.</p>
          ) : (
            friendState.friends.map((friend) => (
              <UserCard key={friend.id} user={friend.user}>
                <button
                  type="button"
                  onClick={() => removeFriendship(friend.id)}
                  disabled={loading}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
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
              background: "#fff",
              padding: 14,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            {message}
          </pre>
        )}
      </div>
    </main>
  );
}
