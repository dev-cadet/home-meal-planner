# Why there is no `loading.tsx` here

A `loading.tsx` creates a Suspense boundary, which makes Next stream the route:
the shell is flushed immediately with **status 200**, and nothing afterwards can
change it. A `notFound()` in the page body then renders the 404 page with a 200
status. `generateMetadata` does not run early enough to beat it either — this
was measured, not assumed.

A `loading.tsx` also applies to every nested segment, so it cannot be scoped to
just a list route while leaving `[id]` unaffected.

Reads here are local SQLite (sub-millisecond), so streaming buys nothing while
costing correct 404s. If a genuinely slow region appears later, wrap *that
region* in an explicit `<Suspense>` inside the page instead — the boundary then
covers only what needs it, and sibling routes keep their status codes.

`Skeleton` and `CardSkeleton` in `components/ui/states.tsx` remain for that use.
