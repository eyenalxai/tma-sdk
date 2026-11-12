# Issue tracker: Linear

Issues and specs for this repository live in Linear. Use the `rata` CLI for all
operations. The GitHub remote (`eyenalxai/tma-sdk`) holds code only; issues do
not live there.

## Conventions

- **Create an issue**: `rata issue create --title "..." --body-file -`. Pipe the
  body with a heredoc.
- **Read an issue**: `rata issue show <ref> --comments --json`
- **List issues**: `rata issue list` with the filters you need. Useful filters:
  `--team`, `--state`, `--state-type`, `--label`, `--assignee`, `--parent`,
  `--text`, `--limit`.
- **Comment on an issue**: `rata issue comment create <ref> --body-file -`
- **Apply / remove labels**: `rata issue label add <ref> <label...>` and
  `rata issue label remove <ref> <label...>`
- **Close**: `rata issue close <ref> --comment "..."`
- **Search**: `rata search "..."`
- **Set a priority**: `rata issue update <ref> --priority <value>`. See **Priorities**.
- **Assign**: `rata issue assign <ref> --assignee me`. See **Assignment**.

An issue reference accepts an identifier (`TMA-42`), a UUID, or a linear.app
issue URL.

The default team is TMA (workspace `founders`). No project is linked, so new
issues land at team level. The link lives in rata's local database, not in this
repository: it is not committed. In a new clone or worktree, run
`rata link --team TMA` once, then most commands need no `--team`.

## Pull requests as a triage surface

**PRs as a request surface: no.** Linear holds issues only. Pull requests stay on
GitHub and do not enter the triage queue. Flip this flag if external PRs later
become feature requests.

## When a skill says "publish to the issue tracker"

Create a Linear issue with `rata issue create`, set its priority, and assign it
to the owner. A spec is an issue too: do not create a project and do not put
`Spec:` in the title; its tickets are its child issues.

## When a skill says "fetch the relevant ticket"

Run `rata issue show <ref> --comments`.

## Specs and tickets

A **spec** is an issue that holds a spec. Do not create a project for it and do
not put `Spec:` in the title. Its tickets are its **child issues**.

- **Publish a spec**: `rata issue create --title "<title>" --body-file -`.
- **Publish the tickets**: `/to-tickets` creates each ticket as a child issue of
  the spec:
  `rata issue create --title "..." --parent <spec-ref> --label ready-for-agent --body-file -`.
  Wire the blocking edges with
  `rata issue link <ticket-ref> --blocked-by <blocker-ref>`.
- **Implement the spec**: `/implement-spec` fetches the whole set with
  `rata issue list --parent <spec-ref> --limit 250 --json`, continuing with
  `--after <pageInfo.endCursor>` while `pageInfo.hasNextPage` is true.
- **Close the spec**: when every ticket of a spec is Done, close the spec with
  `rata issue close <spec-ref>` and a comment that points at the result.

## Priorities

Every issue carries a priority:

- `urgent` — breaks a release or blocks one.
- `high` — blocks other work.
- `medium` — the fallback when no other value applies.
- `low` — nice-to-have.

Set it with `rata issue update <ref> --priority <value>`. `needs-info` and
`wontfix` issues may stay `none`.

## Assignment

Every ready issue is assigned to the owner: create it with `--assignee me`.
The one exception is a wayfinder ticket, which starts unassigned so the frontier
query can find it; the driving dev assigns it on claim.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue labelled `wayfinder:map`,
with **child** issues as tickets.

- **Map**: `rata issue create --title "..." --label wayfinder:map --body-file -`.
- **Child ticket**: `rata issue create --title "..." --parent <map-ref> --label wayfinder:<type> --body-file -`.
  The type labels are `wayfinder:research`, `wayfinder:prototype`,
  `wayfinder:grilling` and `wayfinder:task`.
- **Blocking**: native Linear relations. Wire an edge with
  `rata issue link <child-ref> --blocked-by <blocker-ref>`, or the inverse with
  `rata issue link <blocker-ref> --blocks <child-ref>`. A ticket is unblocked
  when every issue that blocks it is closed.
- **Frontier query**: `rata issue list --parent <map-ref> --unblocked --unassigned --json`.
  The first result in map order wins.
- **Claim**: `rata issue assign <ref> --assignee me`, the session's first write.
- **Resolve**: `rata issue comment create <ref> --body-file -`, then
  `rata issue close <ref>`, then append a context pointer to the map's
  Decisions-so-far with
  `rata issue section append <map-ref> "Decisions so far" --body-file -`.
