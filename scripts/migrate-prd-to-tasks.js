#!/usr/bin/env node

/**
 * PRD → Task Files Migration
 *
 * Reads PRD/roadmap markdown files from a GitHub repo,
 * parses checklists by section, and creates organized
 * tasks/*.md files — one per section.
 *
 * Usage:
 *   node scripts/migrate-prd-to-tasks.js --repo owner/repo-name
 *   node scripts/migrate-prd-to-tasks.js --repo owner/repo-name --dry-run
 *   node scripts/migrate-prd-to-tasks.js --all
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// All repos to process when --all is used
const ALL_REPOS = [
  'nolimitjonesinc/Loomiverse-Online',
  'Nolimit-Labs-Projects/dj-loop',
  'Nolimit-Labs-Projects/neon-meridian---a-vertical-megacity-built-int-ccz5'
];

const PRD_FILE_PATTERN = /(?:prd|roadmap|todo|checklist|tasks).*\.md$/i;

// ============================================
// GITHUB HELPERS (uses gh CLI)
// ============================================

function gh(endpoint) {
  try {
    return execFileSync('gh', ['api', endpoint], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (e) {
    return null;
  }
}

function getFileTree(repo) {
  const raw = gh(`repos/${repo}/git/trees/HEAD?recursive=1`);
  if (!raw) return [];
  const data = JSON.parse(raw);
  return (data.tree || []).map(t => t.path);
}

function getFileContent(repo, filePath) {
  const encoded = encodeURIComponent(filePath);
  const raw = gh(`repos/${repo}/contents/${encoded}`);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (!data.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf8');
}

// ============================================
// PRD PARSER
// ============================================

function parsePRD(content, fileName) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Match ## or ### headings (skip # top-level title)
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headingMatch) {
      // Save previous section if it has tasks
      if (currentSection && currentSection.tasks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        tasks: [],
        source: fileName
      };
      continue;
    }

    // Parse checklist items: - [x] or * [x] format
    const checkMatch = line.match(/^[\s]*[-*]\s*\[([ xX])\]\s*(.+)/);
    if (checkMatch && currentSection) {
      currentSection.tasks.push({
        done: checkMatch[1].toLowerCase() === 'x',
        text: checkMatch[2].trim()
      });
      continue;
    }

    // Parse table-format tasks: | # | Task Name | Complexity | [x] | Notes |
    // The PRD uses tables with [x] or [ ] in a status column
    const tableMatch = line.match(/^\|[^|]*\|([^|]+)\|[^|]*\|\s*\[([ xX])\]\s*\|/);
    if (tableMatch && currentSection) {
      const taskText = tableMatch[1].trim();
      // Skip table headers and dividers
      if (taskText && !taskText.match(/^[-\s]+$/) && taskText.toLowerCase() !== 'task') {
        currentSection.tasks.push({
          done: tableMatch[2].toLowerCase() === 'x',
          text: taskText
        });
      }
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.tasks.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

// ============================================
// TASK FILE GENERATOR
// ============================================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generateTaskFile(section, index) {
  const num = String(index).padStart(2, '0');
  const slug = slugify(section.heading);
  const fileName = `${num}-${slug}.md`;

  const doneCount = section.tasks.filter(t => t.done).length;
  const totalCount = section.tasks.length;

  let content = `# ${section.heading}\n\n`;
  content += `> Source: \`${section.source}\`\n`;
  content += `> Progress: ${doneCount}/${totalCount} tasks done\n\n`;
  content += `## Tasks\n\n`;
  for (const task of section.tasks) {
    const check = task.done ? 'x' : ' ';
    content += `- [${check}] ${task.text}\n`;
  }

  return { fileName, content };
}

// ============================================
// PUSH TO REPO
// ============================================

function pushTaskFiles(repo, taskFiles, dryRun) {
  if (dryRun) {
    console.log(`\n  [DRY RUN] Would create ${taskFiles.length} files in ${repo}/tasks/\n`);
    for (const tf of taskFiles) {
      const doneCount = (tf.content.match(/- \[x\]/g) || []).length;
      const totalCount = (tf.content.match(/- \[[ x]\]/gi) || []).length;
      console.log(`    tasks/${tf.fileName} (${doneCount}/${totalCount} done)`);
    }
    return;
  }

  console.log(`\n  Pushing ${taskFiles.length} task files to ${repo}...`);

  const tmpDir = `/tmp/migrate-tasks-${Date.now()}`;
  try {
    // Clone repo
    execFileSync('git', ['clone', '--depth', '1', `https://github.com/${repo}.git`, tmpDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Create tasks directory
    const tasksDir = path.join(tmpDir, 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });

    // Write each task file
    for (const tf of taskFiles) {
      fs.writeFileSync(path.join(tasksDir, tf.fileName), tf.content);
      console.log(`    + tasks/${tf.fileName}`);
    }

    // Git add
    execFileSync('git', ['add', 'tasks/'], { cwd: tmpDir, encoding: 'utf8', stdio: 'pipe' });

    // Git commit
    const commitMsg = `Add organized task files from PRD migration

Splits PRD checklists into section-based task files.
Each file tracks one area of work independently.
Parallel Claude sessions can edit different files without conflicts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`;

    execFileSync('git', ['commit', '-m', commitMsg], { cwd: tmpDir, encoding: 'utf8', stdio: 'pipe' });

    // Git push
    execFileSync('git', ['push'], { cwd: tmpDir, encoding: 'utf8', stdio: 'pipe' });

    console.log(`  Pushed to ${repo}`);
  } catch (e) {
    console.error(`  Error pushing to ${repo}: ${e.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ============================================
// MAIN
// ============================================

function migrateRepo(repo, dryRun) {
  console.log(`\n========================================`);
  console.log(`  Migrating: ${repo}`);
  console.log(`========================================`);

  // Step 1: Find PRD files
  const tree = getFileTree(repo);
  const prdFiles = tree.filter(f => PRD_FILE_PATTERN.test(f));

  if (prdFiles.length === 0) {
    console.log(`  No PRD/roadmap files found. Skipping.`);
    return;
  }

  console.log(`  Found ${prdFiles.length} PRD file(s):`);
  prdFiles.forEach(f => console.log(`    - ${f}`));

  // Step 2: Parse all PRD files
  const allSections = [];
  for (const file of prdFiles) {
    const content = getFileContent(repo, file);
    if (!content) {
      console.log(`  Could not read: ${file}`);
      continue;
    }

    const sections = parsePRD(content, file);
    console.log(`  ${file}: ${sections.length} sections with tasks`);
    allSections.push(...sections);
  }

  if (allSections.length === 0) {
    console.log(`  No checklist sections found. Skipping.`);
    return;
  }

  // Step 3: Deduplicate sections with same heading (merge tasks)
  const merged = new Map();
  for (const section of allSections) {
    const key = slugify(section.heading);
    if (merged.has(key)) {
      const existing = merged.get(key);
      const existingTexts = new Set(existing.tasks.map(t => t.text));
      for (const task of section.tasks) {
        if (!existingTexts.has(task.text)) {
          existing.tasks.push(task);
        }
      }
      existing.source += `, ${section.source}`;
    } else {
      merged.set(key, { ...section });
    }
  }

  const finalSections = Array.from(merged.values());

  // Step 4: Generate task files
  const taskFiles = finalSections.map((section, i) =>
    generateTaskFile(section, i + 1)
  );

  // Step 5: Summary
  let totalTasks = 0, totalDone = 0;
  for (const section of finalSections) {
    totalTasks += section.tasks.length;
    totalDone += section.tasks.filter(t => t.done).length;
  }
  console.log(`\n  Summary: ${finalSections.length} sections, ${totalDone}/${totalTasks} tasks done`);

  // Step 6: Push (or dry run)
  pushTaskFiles(repo, taskFiles, dryRun);
}

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allRepos = args.includes('--all');
const repoIdx = args.indexOf('--repo');
const repo = repoIdx !== -1 ? args[repoIdx + 1] : null;

if (!repo && !allRepos) {
  console.log(`
PRD → Task Files Migration

Usage:
  node scripts/migrate-prd-to-tasks.js --repo owner/repo-name
  node scripts/migrate-prd-to-tasks.js --repo owner/repo-name --dry-run
  node scripts/migrate-prd-to-tasks.js --all
  node scripts/migrate-prd-to-tasks.js --all --dry-run
`);
  process.exit(0);
}

const repos = allRepos ? ALL_REPOS : [repo];

for (const r of repos) {
  migrateRepo(r, dryRun);
}

console.log('\nDone.');
