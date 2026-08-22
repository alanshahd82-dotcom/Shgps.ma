# Vehicle-experience restoration

- Commit `e72cb50563433314779bcea6abe4c946250cb277` was identified as the problematic vehicle-experience task.
- ATHAR GPS was restored to the parent stable state `aa20c11ca6d08523a31ed290518fb38c8690236d`.
- The restoration was necessary because the previous rollback changed only `dist`; source code also changed and had to be restored from Git.
- Future vehicle feature work must be performed incrementally.
- A dist-only rollback is not sufficient when source code changed.