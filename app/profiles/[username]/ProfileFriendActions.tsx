"use client";

import { useState } from "react";

type SocialStatus =
  | "SELF"
  | "FRIENDS"
  | "INCOMING_REQUEST"
  | "OUTGOING_REQUEST"
  | "BLOCKED"
  | "DECLINED"
  | "NONE";

type Props = {
  currentUserId: string;
  profileUserId: string;
  friendshipId: number | null;
  initialStatus: SocialStatus;
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

function getStatusLabel(status: SocialStatus) {
  const labels: Record<SocialStatus, string> = {
    SELF: "This is your profile",
    FRIENDS: "Friends",
    INCOMING_REQUEST: "Friend request received",
    OUTGOING_REQUEST: "Friend request sent",
    BLOCKED: "Blocked",
    DECLINED: "Request declined",
    NONE: "Not friends",
  };

  return labels[status];
}

export default function ProfileFriendActions({
  currentUserId,
  profileUserId,
  friendshipId,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState<SocialStatus>(initialStatus);
  const [currentFriendshipId, setCurrentFriendshipId] = useState<number | null>(
    friendshipId
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sendRequest() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUserId,
          targetUserId: profileUserId,
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

      setCurrentFriendshipId(data.friendship?.id ?? null);
      setStatus("OUTGOING_REQUEST");
      setMessage("Friend request sent.");
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

  async function updateFriendship(action: "accept" | "decline" | "block") {
    if (!currentFriendshipId) {
      setMessage("Missing friendship ID.");
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
          userId: currentUserId,
          friendshipId: currentFriendshipId,
          action,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data) {
        setMessage(
          JSON.stringify(
            {
              status: res.status,
              error: `Failed to ${action} friend request.`,
              response: data,
            },
            null,
            2
          )
        );
        return;
      }

      if (action === "accept") {
        setStatus("FRIENDS");
        setMessage("Friend request accepted.");
      }

      if (action === "decline") {
        setStatus("DECLINED");
        setMessage("Friend request declined.");
      }

      if (action === "block") {
        setStatus("BLOCKED");
        setMessage("User blocked.");
      }
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

  async function removeFriendship() {
    if (!currentFriendshipId) {
      setMessage("Missing friendship ID.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        userId: currentUserId,
        friendshipId: String(currentFriendshipId),
      });

      const res = await fetch(`/api/friends?${params.toString()}`, {
        method: "DELETE",
      });

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

      setCurrentFriendshipId(null);
      setStatus("NONE");
      setMessage("Friendship removed.");
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

  if (status === "SELF") {
    return null;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          marginBottom: 10,
          display: "inline-block",
          padding: "7px 11px",
          border: "1px solid #ffd6d4",
          borderRadius: 999,
          background: "#fff2f1",
          color: "#111",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {getStatusLabel(status)}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {status === "NONE" && (
          <button
            type="button"
            onClick={sendRequest}
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
            {loading ? "Sending..." : "Add Friend"}
          </button>
        )}

        {status === "DECLINED" && (
          <button
            type="button"
            onClick={sendRequest}
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
            {loading ? "Sending..." : "Send Request Again"}
          </button>
        )}

        {status === "OUTGOING_REQUEST" && (
          <button
            type="button"
            onClick={removeFriendship}
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
            {loading ? "Canceling..." : "Cancel Request"}
          </button>
        )}

        {status === "INCOMING_REQUEST" && (
          <>
            <button
              type="button"
              onClick={() => updateFriendship("accept")}
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
              onClick={() => updateFriendship("decline")}
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
          </>
        )}

        {status === "FRIENDS" && (
          <button
            type="button"
            onClick={removeFriendship}
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
            {loading ? "Removing..." : "Remove Friend"}
          </button>
        )}

        {status !== "BLOCKED" && (
          <button
            type="button"
            onClick={() => updateFriendship("block")}
            disabled={loading || !currentFriendshipId}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
              cursor:
                loading || !currentFriendshipId ? "not-allowed" : "pointer",
            }}
          >
            Block
          </button>
        )}
      </div>

      {message && (
        <pre
          style={{
            marginTop: 12,
            whiteSpace: "pre-wrap",
            background: "#fff",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            color: "#555",
          }}
        >
          {message}
        </pre>
      )}
    </div>
  );
}
