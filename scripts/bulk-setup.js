#!/usr/bin/env node

/**
 * Bulk HQ Setup Script
 *
 * Automatically adds CLAUDE.md and tasks/ to all repos that need them.
 * Clones to a temp directory, adds files, commits, and pushes.
 *
 * Usage: node scripts/bulk-setup.js
 *
 * Note: This script uses execSync with hardcoded repo names only (no user input),
 * so command injection is not a concern here.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GITHUB_USER = 'nolimitjonesinc';

// Repos that need tasks/ directory added
const NEEDS_TASKS = [
  'mockingbirdnews',
  'MASTER_MockingBirdApp',
  'Genesis-Engine',
  'Plug-In-MBN-V6-Master',
  'CrimeCam.Fun'
];

// Repos that need both CLAUDE.md and tasks/
const NEEDS_BOTH = [
  'AD-Scheduler-Pro',
  'Twitter-Bot',
  'DJ-Brain',
  'Gaurdian',
  'EmbersInc',
  'Quiply',
  'Loomiverse',
  'tweetminer',
  'scroll-n-say',
  'Saucypants',
  'InsultGPT'
];

const TASK_TRACKING_SECTION = `## Task Tracking (CRITICAL — READ THIS FIRST)

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

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    console.error(`  Command failed: ${cmd}`);
    console.error(`  ${e.message}`);
    return null;
  }
}

function setupRepo(repo, needsClaude) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Setting up: ${repo}`);
  console.log('='.repeat(50));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-setup-'));
  const repoDir = path.join(tmpDir, repo);

  // Clone using gh CLI (uses authenticated token)
  console.log(`  Cloning...`);
  const cloneResult = run(`gh repo clone ${GITHUB_USER}/${repo} -- --depth 1`, tmpDir);
  if (cloneResult === null) {
    console.log(`  FAILED to clone ${repo}`);
    return false;
  }

  // Create tasks/ directory and starter file
  const tasksDir = path.join(repoDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir);
    console.log(`  Created tasks/`);
  }

  const taskFile = path.join(tasksDir, '01-core-features.md');
  if (!fs.existsSync(taskFile)) {
    const starterTask = `# Core Features

> Source: \`created by bulk-setup script\`
> Progress: 0/4 tasks done

## Tasks

- [ ] Core functionality
- [ ] Clean, minimal UI
- [ ] Error handling
- [ ] Test and verify everything works
`;
    fs.writeFileSync(taskFile, starterTask);
    console.log(`  Created tasks/01-core-features.md`);
  }

  // Create or update CLAUDE.md
  if (needsClaude) {
    const claudePath = path.join(repoDir, 'CLAUDE.md');
    const newClaudeMd = `# ${repo}

${TASK_TRACKING_SECTION}
## Project Overview

<!-- Add project description here -->

## Development Commands

\`\`\`bash
# Add your commands here
npm install
npm run dev
\`\`\`
`;
    fs.writeFileSync(claudePath, newClaudeMd);
    console.log(`  Created CLAUDE.md`);
  }

  // Git add, commit, push
  console.log(`  Committing...`);
  run('git add -A', repoDir);
  const commitResult = run('git commit -m "Add HQ task tracking setup (CLAUDE.md + tasks/)"', repoDir);

  if (commitResult && !commitResult.includes('nothing to commit')) {
    console.log(`  Pushing...`);
    const pushResult = run('git push', repoDir);
    if (pushResult !== null) {
      console.log(`  SUCCESS: ${repo}`);
    } else {
      console.log(`  FAILED to push ${repo}`);
      return false;
    }
  } else {
    console.log(`  No changes needed for ${repo}`);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return true;
}

async function main() {
  console.log('\n🚀 Bulk HQ Setup Script');
  console.log('========================\n');

  const results = { success: [], failed: [] };

  // Setup repos that only need tasks/
  console.log(`\n📁 Adding tasks/ to ${NEEDS_TASKS.length} repos...\n`);
  for (const repo of NEEDS_TASKS) {
    const success = setupRepo(repo, false);
    (success ? results.success : results.failed).push(repo);
  }

  // Setup repos that need both
  console.log(`\n📁 Adding CLAUDE.md + tasks/ to ${NEEDS_BOTH.length} repos...\n`);
  for (const repo of NEEDS_BOTH) {
    const success = setupRepo(repo, true);
    (success ? results.success : results.failed).push(repo);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${results.success.length} repos`);
  results.success.forEach(r => console.log(`   - ${r}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length} repos`);
    results.failed.forEach(r => console.log(`   - ${r}`));
  }

  console.log('\n✨ Done! HQ will pick up these repos on the next refresh.\n');
}

main();
