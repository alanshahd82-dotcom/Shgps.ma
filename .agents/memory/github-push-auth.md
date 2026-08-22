---
name: GitHub push authentication
description: The repository's HTTPS remote may not automatically consume the saved GitHub secret for pushes.
---

Use the workspace GitHub secret through an ephemeral credential helper when HTTPS push reports invalid username or token; never place the token in a remote URL or commit it.

**Why:** A public clone can succeed without credentials while a push still requires explicit authentication.

**How to apply:** Keep the helper process-local, avoid printing the token, and verify the target branch remotely after pushing.