# Agent instructions

The owner's standing instructions for this repository.

## File naming

- Never repeat a shared leading prefix across sibling files. When two or more files in one directory share a leading hyphenated prefix, group them into a directory named after that prefix and drop the prefix from the filenames: `company-admin-options.ts` and `company-member-access.ts` become `company/admin-options.ts` and `company/member-access.ts`.
- Stacked prefixes collapse the same way, one directory per prefix segment: `advertisement-lead-chat-inbox-rows.ts` becomes `advertisement/lead/chat/inbox/rows.ts`.
- When the directory already names the concept (singular or plural), drop the redundant prefix in place: `companies/company-card.tsx` becomes `companies/card.tsx`.
- A file named exactly after the prefix (or its plural) stays as the entry file next to the group directory: `schedule.ts` next to `schedule/`.
- React hook files keep the `use-` prefix; only the domain prefix after it is grouped or dropped: `use-advertisement-chat-reply.ts` becomes `advertisement/chat/use-reply.ts`.
- Cross-directory imports use the package's `#lib/*` and `#hooks/*` subpath imports; parent-relative imports are lint errors.

## Agent skills

### Issue tracker

Issues live in Linear (team TMA), driven with the `rata` CLI. Every issue carries a priority. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
