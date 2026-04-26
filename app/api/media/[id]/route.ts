import { getMediaById } from "@/lib/media";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const mediaId = Number(id);

  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return NextResponse.json(
      { error: "Invalid media ID." },
      { status: 400 }
    );
  }

  const media = await getMediaById(mediaId);

  if (!media) {
    return NextResponse.json(
      { error: "Media not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(media);
}