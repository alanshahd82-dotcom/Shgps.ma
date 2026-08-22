# Vehicle detail route unification

- Client vehicle links previously opened two different routes.
- `/client/vehicle/:id` is the official vehicle route established by the Home page and renders the same page as Home.
- Client vehicle entry points were unified toward the Home route without changing vehicle data or tracking behavior.
- No backend, Traccar, database, or API changes were made.
- Build and `git diff --check` passed for the route-only change.