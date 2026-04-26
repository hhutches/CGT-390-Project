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
          padding: "6px 10px",
          border: "1px solid #ccc",
          borderRadius: 999,
          background: "#f7f7f7",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {getStatusLabel(status)}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status === "NONE" && (
          <button
            type="button"
            onClick={sendRequest}
            disabled={loading}
            style={{ padding: "8px 12px" }}
          >
            {loading ? "Sending..." : "Add Friend"}
          </button>
        )}

        {status === "DECLINED" && (
          <button
            type="button"
            onClick={sendRequest}
            disabled={loading}
            style={{ padding: "8px 12px" }}
          >
            {loading ? "Sending..." : "Send Request Again"}
          </button>
        )}

        {status === "OUTGOING_REQUEST" && (
          <button
            type="button"
            onClick={removeFriendship}
            disabled={loading}
            style={{ padding: "8px 12px" }}
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
              style={{ padding: "8px 12px" }}
            >
              Accept
            </button>

            <button
              type="button"
              onClick={() => updateFriendship("decline")}
              disabled={loading}
              style={{ padding: "8px 12px" }}
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
            style={{ padding: "8px 12px" }}
          >
            {loading ? "Removing..." : "Remove Friend"}
          </button>
        )}

        {status !== "BLOCKED" && (
          <button
            type="button"
            onClick={() => updateFriendship("block")}
            disabled={loading || !currentFriendshipId}
            style={{ padding: "8px 12px" }}
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
            background: "#f6f6f6",
            padding: 10,
            borderRadius: 8,
          }}
        >
          {message}
        </pre>
      )}
    </div>
  );
}