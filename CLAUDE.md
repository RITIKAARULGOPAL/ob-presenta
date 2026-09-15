@AGENTS.md
@PROGRESS.md

If `PROGRESS.md.pending` exists at the start of a session: a SessionEnd hook
(see `.claude/settings.json`) auto-logged raw git facts from a session that
ended with uncommitted changes, since it can't reliably invoke Claude itself
non-interactively to write a polished entry. Fold its contents into a proper
dated entry in `PROGRESS.md` (Done / Left off & next up / Watch out for, per
the protocol at the top of that file), then delete `PROGRESS.md.pending`.
