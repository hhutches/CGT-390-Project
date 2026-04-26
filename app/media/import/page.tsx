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
    message: "Loading media...",
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
  }, [provider, externalId, type, missingParams]);

  useEffect(() => {
    if (state.status !== "ready") return;

    router.replace(`/media/${state.mediaId}`);
  }, [state, router]);

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        {state.status === "loading" ? (
          <>
            <h1 className="text-2xl font-semibold">Preparing media page...</h1>
            <p className="mt-3 text-neutral-400">{state.message}</p>
          </>
        ) : null}

        {state.status === "error" ? (
          <>
            <h1 className="text-2xl font-semibold">Could not open this item</h1>
            <p className="mt-3 text-neutral-400">{state.message}</p>
            <a
              href="/search"
              className="mt-6 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Back to search
            </a>
          </>
        ) : null}

        {state.status === "ready" ? (
          <>
            <h1 className="text-2xl font-semibold">
              {state.title ? `Opening ${state.title}...` : "Opening media..."}
            </h1>
            <p className="mt-3 text-neutral-400">
              Taking you to the media overview page.
            </p>
            <a
              href={`/media/${state.mediaId}`}
              className="mt-6 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Open now
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function MediaImportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
          <div className="mx-auto max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h1 className="text-2xl font-semibold">Preparing media page...</h1>
            <p className="mt-3 text-neutral-400">Loading media...</p>
          </div>
        </main>
      }
    >
      <MediaImportInner />
    </Suspense>
  );
}
