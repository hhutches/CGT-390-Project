"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ImportState =
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; mediaId: string; title?: string | null };

function MediaImportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const provider = searchParams.get("provider");
  const externalId = searchParams.get("externalId");
  const type = searchParams.get("type");

  const [state, setState] = useState<ImportState>({
    status: "loading",
    message: "Opening media…",
  });

  const missingParams = useMemo(() => {
    const missing: string[] = [];

    if (!provider) missing.push("provider");
    if (!externalId) missing.push("externalId");
    if (!type) missing.push("type");

    return missing;
  }, [provider, externalId, type]);

  useEffect(() => {
    let cancelled = false;

    async function importMedia() {
      if (missingParams.length > 0) {
        setState({
          status: "error",
          message: `Missing required parameter: ${missingParams.join(", ")}`,
        });
        return;
      }

      try {
        const response = await fetch("/api/media/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            externalId,
            type,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to import media.");
        }

        const mediaId =
          data?.media?.id ||
          data?.mediaItem?.id ||
          data?.item?.id ||
          data?.id ||
          data?.mediaId;

        if (!mediaId) {
          throw new Error("Import succeeded, but no media ID was returned.");
        }

        if (!cancelled) {
          setState({
            status: "ready",
            mediaId: String(mediaId),
            title:
              data?.media?.title ||
              data?.mediaItem?.title ||
              data?.item?.title ||
              null,
          });

          router.replace(`/media/${mediaId}`);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to import media.",
          });
        }
      }
    }

    importMedia();

    return () => {
      cancelled = true;
    };
  }, [provider, externalId, type, missingParams, router]);

  return (
    <main
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        background: "#f7f8fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 18,
          padding: 32,
        }}
      >
        {state.status === "loading" ? (
          <>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "4px solid #ffe2df",
                borderTopColor: "#ff7f7a",
                marginBottom: 18,
              }}
            />

            <p
              style={{
                margin: "0 0 8px",
                color: "#d95d59",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: 13,
              }}
            >
              Importing
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.1,
              }}
            >
              Opening media…
            </h1>

            <p
              style={{
                marginTop: 12,
                marginBottom: 0,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              {state.message}
            </p>
          </>
        ) : null}

        {state.status === "error" ? (
          <>
            <p
              style={{
                margin: "0 0 8px",
                color: "#d95d59",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: 13,
              }}
            >
              Import error
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.1,
              }}
            >
              Could not open this item
            </h1>

            <p
              style={{
                marginTop: 12,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              {state.message}
            </p>

            <a
              href="/search"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ff7f7a",
                background: "#ff7f7a",
                color: "white",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to Search
            </a>
          </>
        ) : null}

        {state.status === "ready" ? (
          <>
            <p
              style={{
                margin: "0 0 8px",
                color: "#d95d59",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: 13,
              }}
            >
              Ready
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.1,
              }}
            >
              {state.title ? `Opening ${state.title}…` : "Opening media…"}
            </h1>

            <p
              style={{
                marginTop: 12,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              Taking you to the media overview page.
            </p>

            <a
              href={`/media/${state.mediaId}`}
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ff7f7a",
                background: "#ff7f7a",
                color: "white",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Open Now
            </a>
          </>
        ) : null}
      </section>
    </main>
  );
}

export default function MediaImportPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            width: "100%",
            minHeight: "100vh",
            margin: 0,
            boxSizing: "border-box",
            background: "#f7f8fa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 18,
              padding: 32,
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "#d95d59",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: 13,
              }}
            >
              Loading
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.1,
              }}
            >
              Opening media…
            </h1>

            <p
              style={{
                marginTop: 12,
                marginBottom: 0,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              Loading item details.
            </p>
          </section>
        </main>
      }
    >
      <MediaImportInner />
    </Suspense>
  );
}
