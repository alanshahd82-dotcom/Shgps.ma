---
name: Duplicate artifact workflow ports
description: The workspace can contain duplicated artifact workflows that compete for the same managed port.
---

When a nested artifact workflow fails with `EADDRINUSE`, check for a root artifact workflow serving the same port before changing application code or adding another workflow.

**Why:** The project snapshot can register both root and nested artifact services, while both managed API workflows bind the same port.

**How to apply:** Treat the collision as environment/workflow configuration, avoid expanding unrelated artifacts, and verify the application with direct build and syntax checks when the project has no dedicated frontend workflow.