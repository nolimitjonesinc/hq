# DJ's Command Center

A personal project tracker dashboard with Focus Mode and Command Mode.

## Quick Start

### 1. Run Locally

```bash
cd command-center
npx serve public
```

Then open http://localhost:3000

### 2. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy the public folder
cd command-center
vercel public
```

Share the URL with your wife!

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Work     │     │    Scanner      │     │   Dashboard     │
│                 │     │                 │     │                 │
│ - GitHub repos  │────▶│ Reads PRDs,     │────▶│ Shows progress  │
│ - PRD.md files  │     │ updates JSON    │     │ to you & wife   │
│ - Claude Code   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `public/index.html` | The dashboard (deploy this) |
| `public/data.json` | Your project data (the source of truth) |
| `scripts/scanner.js` | CLI tool to update data.json |

---

## CLI Commands

### Check Status
```bash
npm run status
```

Shows current focus for all projects.

### Scan Projects
```bash
npm run scan
```

Scans your local repos, checks git status, reads PRD files.

### Mark Task Done
```bash
node scripts/scanner.js --mark-done l-s5
```

Marks a task/subtask as complete and auto-advances to next.

### Set Current Task
```bash
node scripts/scanner.js --set-current l-t9
```

Sets a specific task as the current focus.

---

## Setup Scanner

Edit `scripts/scanner.js` and update the `PROJECT_PATHS` object to point to your local project directories:

```javascript
const PROJECT_PATHS = {
  'loomiverse': '~/Projects/loomiverse',
  'quiplee': '~/Projects/quiplee',
  // ... add your paths
};
```

---

## Data Structure

The `data.json` file has this structure:

```json
{
  "meta": {
    "lastUpdated": "2025-01-26T12:00:00Z"
  },
  "projects": [
    {
      "id": "project-id",
      "name": "Project Name",
      "emoji": "📖",
      "status": "active",  // active | live | paused
      "priority": 1,
      "color": "#8b5cf6",
      "milestones": [
        {
          "id": "m1",
          "name": "Milestone Name",
          "done": false,
          "current": true,
          "dueDate": "2025-02-01",
          "tasks": [
            {
              "id": "t1",
              "name": "Task Name",
              "done": false,
              "current": true,
              "aiTime": 30,  // minutes with Claude Code
              "subtasks": [...]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Time Estimates

Times are in **minutes** and represent "with Claude Code" estimates:

| aiTime | Meaning |
|--------|---------|
| 15 | Quick fix, simple change |
| 30 | Small feature |
| 45 | Medium feature |
| 60 | Larger feature |
| 90+ | Complex work |

---

## Modes

### Focus Mode
Shows ONE task - what to work on right now. Includes:
- Current task name
- Time estimate
- Subtask progress
- Upcoming deadlines

### Command Mode
Full overview for you or your wife. Includes:
- All projects with progress %
- Expandable milestones/tasks/subtasks
- Calendar view with deadlines

---

## Auto-Refresh

The dashboard auto-refreshes every 5 minutes. You can also manually refresh by reloading the page.

---

## Phase 2: Full Automation (Coming Soon)

- [ ] Watch for file changes
- [ ] Auto-parse PRD checklists
- [ ] Sync with GitHub PRs
- [ ] Hourly background updates
- [ ] Slack/email notifications

---

## Need Help?

The data.json file is the source of truth. Edit it manually if needed, or use the scanner CLI commands.
