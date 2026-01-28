#!/usr/bin/env node

/**
 * Project Setup Script
 *
 * Sets up a new project with task tracking for HQ.
 * Run this in any project folder to add:
 *   - tasks/ directory with starter checklist
 *   - CLAUDE.md with task tracking instructions
 *
 * Usage:
 *   From anywhere: node ~/Desktop/command-center/scripts/setup-project.js
 *   Or if you set up the alias: hq-setup
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const projectName = path.basename(cwd);

console.log(`\n🚀 Setting up task tracking for: ${projectName}\n`);

// Create tasks/ directory
const tasksDir = path.join(cwd, 'tasks');
if (!fs.existsSync(tasksDir)) {
  fs.mkdirSync(tasksDir);
  console.log('✅ Created tasks/ directory');
} else {
  console.log('⏭️  tasks/ directory already exists');
}

// Create starter task file if tasks/ is empty
const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
if (taskFiles.length === 0) {
  const starterTask = `# Core Features

> Source: \`created by setup script\`
> Progress: 0/4 tasks done

## Tasks

- [ ] Core functionality
- [ ] Clean, minimal UI
- [ ] Error handling
- [ ] Test and verify everything works
`;
  fs.writeFileSync(path.join(tasksDir, '01-core-features.md'), starterTask);
  console.log('✅ Created tasks/01-core-features.md (starter checklist)');
} else {
  console.log(`⏭️  tasks/ already has ${taskFiles.length} file(s)`);
}

// Create or update CLAUDE.md
const claudeMdPath = path.join(cwd, 'CLAUDE.md');
const taskTrackingSection = `## Task Tracking (CRITICAL — READ THIS FIRST)

**Tasks are tracked in the \`tasks/\` directory** — one file per section.
Each file has markdown checklists (\`- [x]\` done, \`- [ ]\` undone).
HQ (hq.nolimitjones.com) reads these files automatically.

### Before Starting ANY Work

1. **Read the \`tasks/\` directory** — list all files, understand what sections exist
2. **Find the task file that matches your work** — open the relevant one
3. Confirm with the user which task to work on

### When You COMPLETE a Task

1. Open the relevant \`tasks/*.md\` file
2. Change the item from \`- [ ]\` to \`- [x]\`
3. **Commit the task file update in the SAME commit as your code changes**
4. Tell the user what was completed and suggest the next task

### When You DISCOVER New Work

If you find a bug, missing feature, or something that needs doing:
1. Find the most relevant \`tasks/*.md\` file for that area
2. Add a new \`- [ ]\` item at the end of the Tasks section
3. Include it in your next commit
4. Tell the user what you added and why

### When a Task Needs to CHANGE

If a task is wrong, outdated, too broad, or needs splitting:
1. **Don't delete it** — mark \`- [x] (REMOVED — reason)\` or \`- [x] (SPLIT — see below)\`
2. Add the corrected/split tasks as new \`- [ ]\` items
3. This preserves history so nothing gets lost

### When a Task Doesn't Fit Any Existing File

If your work doesn't match any existing task file:
1. Create a new file: \`tasks/XX-descriptive-name.md\` (use the next available number)
2. Use this format:
   \`\`\`
   # Section Name

   > Source: \`created by Claude session\`
   > Progress: 0/N tasks done

   ## Tasks

   - [ ] First task
   - [ ] Second task
   \`\`\`
3. Commit it with your code changes

### Parallel Session Safety

- Each task file covers a different area of work
- **Only edit the task file relevant to YOUR current work**
- Do NOT edit other task files you aren't working on
- This prevents git merge conflicts between parallel sessions

### ADHD Reminder

Danny has ADHD — **nothing should ever vanish without a trace.**
- Don't silently delete tasks. Mark them and note why.
- New discoveries MUST be written down immediately or they'll be forgotten.
- If a feature gets disabled, add a \`- [ ]\` item to re-enable it later.

---

`;

if (fs.existsSync(claudeMdPath)) {
  const existing = fs.readFileSync(claudeMdPath, 'utf8');
  if (existing.includes('Task Tracking')) {
    console.log('⏭️  CLAUDE.md already has task tracking instructions');
  } else {
    // Prepend task tracking to existing CLAUDE.md
    const updated = existing.replace(/^# .*\n/, match => match + '\n' + taskTrackingSection);
    fs.writeFileSync(claudeMdPath, updated);
    console.log('✅ Added task tracking instructions to existing CLAUDE.md');
  }
} else {
  // Create new CLAUDE.md
  const newClaudeMd = `# ${projectName}

${taskTrackingSection}
## Project Overview

<!-- Add project description here -->

## Development Commands

\`\`\`bash
# Add your commands here
npm install
npm run dev
\`\`\`
`;
  fs.writeFileSync(claudeMdPath, newClaudeMd);
  console.log('✅ Created CLAUDE.md with task tracking instructions');
}

console.log(`
✨ Done! This project is now set up for HQ tracking.

Next steps:
1. Edit tasks/01-core-features.md with your actual tasks
2. Customize CLAUDE.md with project-specific details
3. Commit and push — HQ will pick it up automatically

`);
