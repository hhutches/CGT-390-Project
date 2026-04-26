import { NextResponse } from "next/server";

type GoogleBookVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    averageRating?: number;
    ratingsCount?: number;
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    language?: string;
    infoLink?: string;
  };
};

function normalizeDate(value?: string) {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return value;
}

function secureImage(url?: string) {
  if (!url) return null;
  return url.replace("http://", "https://");
}

function getIsbn13(book: GoogleBookVolume) {
  const ids = book.volumeInfo?.industryIdentifiers ?? [];

  return (
    ids.find((id) => id.type === "ISBN_13")?.identifier ??
    ids.find((id) => id.type === "ISBN_10")?.identifier ??
    null
  );
}

function getGoogleBooksQuery(query: string, searchBy: string | null) {
  const trimmed = query.trim();

  if (searchBy === "author") {
    return `inauthor:${trimmed}`;
  }

  if (searchBy === "isbn") {
    return `isbn:${trimmed}`;
  }

  return trimmed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") ?? "";
  const searchBy = searchParams.get("searchBy");

  if (!q.trim()) {
    return NextResponse.json(
      { error: "Search query is required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_BOOKS_API_KEY is missing from .env." },
      { status: 500 }
    );
  }

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", getGoogleBooksQuery(q, searchBy));
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("printType", "books");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Google Books search failed.",
        status: response.status,
        googleResponse: data,
      },
      { status: response.status }
    );
  }

  const results = (data.items ?? []).map((book: GoogleBookVolume) => {
    const info = book.volumeInfo ?? {};
    const title = info.subtitle
      ? `${info.title ?? "Untitled Book"}: ${info.subtitle}`
      : info.title ?? "Untitled Book";

    return {
      provider: "GOOGLE_BOOKS",
      externalId: book.id,
      type: "BOOK",
      title,
      description: info.description ?? null,
      releaseDate: normalizeDate(info.publishedDate),
      coverUrl:
        secureImage(info.imageLinks?.thumbnail) ??
        secureImage(info.imageLinks?.smallThumbnail),
      languageCode: info.language ?? null,
      externalUrl: info.infoLink ?? null,
      authors: info.authors ?? [],
      pageCount: info.pageCount ?? null,
      averageRating: info.averageRating ?? null,
      ratingsCount: info.ratingsCount ?? null,
      isbn13: getIsbn13(book),
      raw: book,
    };
  });

  return NextResponse.json({ results });
}