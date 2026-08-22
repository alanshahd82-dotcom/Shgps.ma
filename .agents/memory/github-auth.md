---
name: GitHub authentication
description: Git operations against this repository require GitHub token URL authentication in this environment.
---

Use the stored GitHub secret with the `x-access-token` HTTPS form for clone and push; Authorization header forms may be rejected even when the token is valid.

**Why:** The repository accepted the same credential through the GitHub HTTPS token-user form but rejected Bearer and token Authorization headers.

**How to apply:** Never print the secret; use a temporary authenticated remote only for the Git operation and restore or avoid persisting credentials in Git config.