---
name: GitHub push authentication
description: GitHub PATs can validate through the API while Git HTTPS rejects Bearer authentication for pushes.
---

Use GitHub PATs for repository pushes with HTTP Basic authentication using `x-access-token` as the username, rather than an HTTP Bearer extra header.

**Why:** The repository accepted API authentication and confirmed push permission, but Git rejected the Bearer header; Basic authentication succeeded.

**How to apply:** Keep the PAT only in the secure secret store, construct the Basic auth header ephemerally for the push, and never place the token in remotes, files, logs, or chat.