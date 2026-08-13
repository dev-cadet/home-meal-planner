import Link from "next/link";

/** Rendered when the DAL calls `forbidden()` — signed in, but not an admin. */
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-stone-500 dark:text-stone-400">403</p>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
        Admins only
      </h1>
      <p className="max-w-sm text-stone-600 dark:text-stone-400">
        You are signed in, but this page needs administrator access.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center rounded-lg border border-stone-300 px-5 font-medium text-stone-900 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800"
      >
        Back to home
      </Link>
    </main>
  );
}
