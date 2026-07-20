# Command Center — Status
_Auto-updated by Status Brain on every push. Last change: Added Status Brain workflow to auto-generate this status file on each push._

**Status:** In progress  
**What it is:** A personal project dashboard that auto-scans your GitHub repos and local PRD files to show progress across all your projects in one place.  
**Stack:** Node.js, vanilla JavaScript, HTML/CSS, Vercel deployment, GitHub API.

## What works right now
- Dashboard UI (Focus Mode and Command Mode) that displays projects, milestones, and tasks
- Scanner CLI tool that reads PRD.md files from local repos and updates data.json
- GitHub API integration to auto-discover private and public repos
- CLI commands to mark tasks done, set current focus, and check status
- Service worker for offline PWA functionality
- Auto-deployment to Vercel
- Project setup script (hq-setup) for initializing new projects with templates
- Table-format parsing for task lists in PRD files
- Migration script to convert old PRD format to new tasks/ directory structure

## Recent changes (newest first)
- 2026-07-20 — Added Status Brain workflow (auto-generates this status file)
- 2026-07-20 — Added Status Brain script (status-brain.mjs)
- 2026-01-30 — Fixed GitHub API to include private repos
- 2026-01-30 — Triggered redeploy with new GitHub token
- 2026-01-29 — Bumped service worker cache to force fresh HTML
- 2026-01-29 — Added Command Center with HQ setup, UI improvements, and bulk setup script
- 2026-01-28 — Added hq-setup script for new project initialization
- 2026-01-27 — Added table-format parsing, tasks/ dir priority, and migration script

## Reusable parts (for other projects)
- **Scanner system** — Reads local repos and PRD.md files to auto-generate project data — `scripts/scanner.js`
- **GitHub API auto-discovery** — Zero-config detection of all your repos (private + public) — `api/data.js`
- **Setup script** — Bootstrap template for new projects with PRD structure — `scripts/setup-project.js`
- **Status Brain** — Auto-document project status on every push — `status-brain.mjs`

## Not done / next
- No manual editing UI yet (all updates via CLI or auto-scan)
- No sync between local file changes and dashboard without running `npm run scan`
- No real-time updates to data.json (on-demand only)
- Wife visibility/sharing features mentioned in README not fully documented
- Claude.md integration exists but unclear what it controls
- No task creation UI in the dashboard (tasks must exist in PRD.md first)
