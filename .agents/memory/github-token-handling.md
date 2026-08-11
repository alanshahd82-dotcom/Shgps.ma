---
name: GitHub token handling
description: Keep GitHub credentials out of repository remotes and command output during authenticated pushes.
---

Use an ephemeral authenticated push URL only for the push command, then keep the configured remote credential-free. Never print token-bearing URLs or save them in project files.

**Why:** Git can persist credentials embedded in a clone URL inside `.git/config`, making an otherwise secure token visible to local tooling and logs.

**How to apply:** Prefer the GitHub integration; if a secret is necessary, use the secure secrets flow, push with a transient URL, reset the remote to the public repository URL, and advise rotating any token that was exposed.