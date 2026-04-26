"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) return;

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <a href="/" className="text-lg font-semibold">
          Media App
        </a>

        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies, TV, books, music, games…"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-400"
          />

          <button
            type="submit"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Search
          </button>
        </form>

        <a href="/add-entry" className="text-sm text-neutral-300 hover:text-white">
          Add Entry
        </a>
      </div>
    </nav>
  );
}
