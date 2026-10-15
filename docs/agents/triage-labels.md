# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles
to the actual label strings used in this repo's issue tracker.

## State roles

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Considered and rejected                  |

## Category roles

`Bug` (workspace-level, shared with team FND) and `enhancement` (team TMA).
A live, triaged issue carries exactly one category role and one state role.

## Close reasons

A closed issue carries a close-reason label instead of a state role:

| Close reason                                       | Label                 |
| -------------------------------------------------- | --------------------- |
| Another issue covers it                            | `duplicate`           |
| The requested behaviour already exists in the code | `already-implemented` |
| No longer relevant (old, unreproducible, passed)   | `stale`               |
| Superseded, or the feature was removed             | `obsolete`            |
| Considered and rejected                            | `wontfix`             |

- `duplicate` — set the native Linear duplicate relation with
  `rata issue link <ref> --duplicate <other-ref>` and post a pointer comment
  naming the canonical issue.
- `already-implemented` — post a pointer comment saying where the behaviour
  lives. Never write an `.out-of-scope/` entry: it is a built feature, not a
  rejected one.
- `stale` / `obsolete` — post a short note on why, and what superseded it when
  applicable. Neither writes to `.out-of-scope/`.
- `wontfix` — a deliberate rejection. Only rejected _enhancement requests_
  additionally get an `.out-of-scope/` entry.
