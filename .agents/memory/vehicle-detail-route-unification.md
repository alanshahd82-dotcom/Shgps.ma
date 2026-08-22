# Vehicle detail route unification

- Client vehicle links previously opened two different routes.
- `/client/vehicle/:id` is the official Vehicle Detail route and renders `DeviceDetail.jsx`.
- Client vehicle entry points were unified without changing vehicle data or tracking behavior.
- No backend, Traccar, database, or API changes were made.
- Build and `git diff --check` passed for the route-only change.