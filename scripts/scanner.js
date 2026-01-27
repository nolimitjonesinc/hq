#!/usr/bin/env node

/**
 * Command Center Scanner
 * 
 * Scans your local project directories, reads PRD files,
 * and updates the command center data.json
 * 
 * Usage:
 *   node scanner.js                    # Scan all projects
 *   node scanner.js --project loomiverse  # Scan specific project
 *   node scanner.js --mark-done l-s5   # Mark a task/subtask as done
 *   node scanner.js --set-current l-t9 # Set a task as current
 * 
 * Setup:
 *   1. Edit PROJECT_PATHS below to point to your local repos
 *   2. Run: node scanner.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================
// CONFIGURATION - EDIT THESE PATHS
// ============================================

const PROJECT_PATHS = {
  'loomiverse': '~/Projects/loomiverse',
  'quiplee': '~/Projects/quiplee',
  'command-center': '~/Projects/command-center',
  'emergent-chars': '~/Projects/emergent-characters',
  'tron-games': '~/Projects/tron-games',
  'tweetminer': '~/Projects/tweetminer',
  'pareidolia': '~/Projects/pareidolia'
};

const DATA_FILE = path.join(__dirname, '../public/data.json');

// ============================================
// HELPERS
// ============================================

function expandPath(p) {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME, p.slice(2));
  }
  return p;
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('❌ Could not load data.json:', e.message);
    process.exit(1);
  }
}

function saveData(data) {
  data.meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Saved data.json');
}

function getGitStatus(projectPath) {
  try {
    const fullPath = expandPath(projectPath);
    if (!fs.existsSync(fullPath)) {
      return { exists: false };
    }

    // Get last commit info
    const lastCommit = execSync(
      'git log -1 --format="%H|%s|%ci" 2>/dev/null || echo "none"',
      { cwd: fullPath, encoding: 'utf8' }
    ).trim();

    if (lastCommit === 'none') {
      return { exists: true, git: false };
    }

    const [hash, message, date] = lastCommit.split('|');

    // Get current branch
    const branch = execSync(
      'git branch --show-current 2>/dev/null || echo "unknown"',
      { cwd: fullPath, encoding: 'utf8' }
    ).trim();

    // Check for uncommitted changes
    const status = execSync(
      'git status --porcelain 2>/dev/null || echo ""',
      { cwd: fullPath, encoding: 'utf8' }
    ).trim();

    return {
      exists: true,
      git: true,
      branch,
      lastCommit: {
        hash: hash.slice(0, 7),
        message,
        date: new Date(date)
      },
      hasChanges: status.length > 0,
      changedFiles: status.split('\n').filter(Boolean).length
    };
  } catch (e) {
    return { exists: true, git: false, error: e.message };
  }
}

function parsePRDFile(projectPath, prdPath) {
  try {
    const fullPath = path.join(expandPath(projectPath), prdPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Extract checklist items (- [ ] or - [x])
    const checklistRegex = /^[\s]*[-*]\s*\[([ xX])\]\s*(.+)$/gm;
    const items = [];
    let match;

    while ((match = checklistRegex.exec(content)) !== null) {
      items.push({
        done: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      });
    }

    return {
      path: prdPath,
      checklistItems: items,
      totalItems: items.length,
      completedItems: items.filter(i => i.done).length
    };
  } catch (e) {
    return null;
  }
}

function findTaskById(data, taskId) {
  for (const project of data.projects) {
    for (const milestone of project.milestones) {
      if (milestone.id === taskId) {
        return { type: 'milestone', item: milestone, parent: project };
      }
      if (milestone.tasks) {
        for (const task of milestone.tasks) {
          if (task.id === taskId) {
            return { type: 'task', item: task, parent: milestone };
          }
          if (task.subtasks) {
            for (const subtask of task.subtasks) {
              if (subtask.id === taskId) {
                return { type: 'subtask', item: subtask, parent: task };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function clearCurrentFlags(data) {
  for (const project of data.projects) {
    for (const milestone of project.milestones) {
      delete milestone.current;
      if (milestone.tasks) {
        for (const task of milestone.tasks) {
          delete task.current;
          if (task.subtasks) {
            for (const subtask of task.subtasks) {
              delete subtask.current;
            }
          }
        }
      }
    }
  }
}

// ============================================
// COMMANDS
// ============================================

function cmdScan(projectId = null) {
  console.log('\n🔍 Scanning projects...\n');
  const data = loadData();

  const projectsToScan = projectId 
    ? data.projects.filter(p => p.id === projectId)
    : data.projects;

  for (const project of projectsToScan) {
    const localPath = PROJECT_PATHS[project.id];
    
    if (!localPath) {
      console.log(`⚠️  ${project.emoji} ${project.name}: No local path configured`);
      continue;
    }

    console.log(`📁 ${project.emoji} ${project.name}`);
    
    // Check git status
    const git = getGitStatus(localPath);
    
    if (!git.exists) {
      console.log(`   ❌ Directory not found: ${localPath}`);
      continue;
    }

    if (!git.git) {
      console.log(`   ⚠️  Not a git repository`);
    } else {
      console.log(`   🌿 Branch: ${git.branch}`);
      console.log(`   📝 Last commit: ${git.lastCommit.message}`);
      console.log(`   📅 ${git.lastCommit.date.toLocaleDateString()}`);
      if (git.hasChanges) {
        console.log(`   ⚡ ${git.changedFiles} uncommitted changes`);
      }
    }

    // Check PRD file
    if (project.prdPath) {
      const prd = parsePRDFile(localPath, project.prdPath);
      if (prd) {
        console.log(`   📋 PRD: ${prd.completedItems}/${prd.totalItems} items checked`);
        
        // Could auto-update tasks here based on PRD checklist
        // For now, just reporting
      } else {
        console.log(`   ⚠️  PRD not found: ${project.prdPath}`);
      }
    }

    console.log('');
  }

  data.meta.lastScanType = 'auto';
  saveData(data);
}

function cmdMarkDone(taskId) {
  const data = loadData();
  const found = findTaskById(data, taskId);

  if (!found) {
    console.error(`❌ Task not found: ${taskId}`);
    process.exit(1);
  }

  found.item.done = true;
  found.item.completedAt = new Date().toISOString();
  delete found.item.current;

  console.log(`✅ Marked as done: ${found.item.name}`);
  
  // Auto-advance to next item
  if (found.type === 'subtask' && found.parent.subtasks) {
    const idx = found.parent.subtasks.findIndex(s => s.id === taskId);
    if (idx < found.parent.subtasks.length - 1) {
      found.parent.subtasks[idx + 1].current = true;
      console.log(`➡️  Next: ${found.parent.subtasks[idx + 1].name}`);
    }
  }

  saveData(data);
}

function cmdSetCurrent(taskId) {
  const data = loadData();
  const found = findTaskById(data, taskId);

  if (!found) {
    console.error(`❌ Task not found: ${taskId}`);
    process.exit(1);
  }

  // Clear all current flags first
  clearCurrentFlags(data);

  // Set the new current
  found.item.current = true;

  // Also mark parent milestone as current if it's a task
  if (found.type === 'task' || found.type === 'subtask') {
    // Find and mark parent milestone
    for (const project of data.projects) {
      for (const milestone of project.milestones) {
        if (milestone.tasks) {
          const hasTask = milestone.tasks.some(t => 
            t.id === taskId || (t.subtasks && t.subtasks.some(s => s.id === taskId))
          );
          if (hasTask) {
            milestone.current = true;
            break;
          }
        }
      }
    }
  }

  console.log(`🎯 Set as current: ${found.item.name}`);
  saveData(data);
}

function cmdStatus() {
  const data = loadData();
  
  console.log('\n📊 Command Center Status\n');
  console.log(`Last updated: ${new Date(data.meta.lastUpdated).toLocaleString()}`);
  console.log(`Last scan: ${data.meta.lastScanType}\n`);

  for (const project of data.projects) {
    const current = project.milestones.find(m => m.current);
    const progress = calculateProgress(project);
    
    const statusEmoji = {
      'active': '🟢',
      'live': '🔵',
      'paused': '⏸️'
    }[project.status] || '⚪';

    console.log(`${statusEmoji} ${project.emoji} ${project.name} (${progress}%)`);
    
    if (current) {
      console.log(`   → ${current.name}`);
      const currentTask = current.tasks?.find(t => t.current);
      if (currentTask) {
        console.log(`     → ${currentTask.name}`);
        const currentSubtask = currentTask.subtasks?.find(s => s.current);
        if (currentSubtask) {
          console.log(`       → ${currentSubtask.name}`);
        }
      }
    }
  }
  console.log('');
}

function calculateProgress(project) {
  let total = 0, done = 0;
  for (const m of project.milestones) {
    if (m.tasks?.length) {
      for (const t of m.tasks) {
        if (t.subtasks?.length) {
          for (const s of t.subtasks) {
            total++; if (s.done) done++;
          }
        } else {
          total++; if (t.done) done++;
        }
      }
    } else {
      total++; if (m.done) done++;
    }
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function cmdHelp() {
  console.log(`
Command Center Scanner

Usage:
  node scanner.js                     Scan all projects
  node scanner.js --status            Show current status
  node scanner.js --project <id>      Scan specific project
  node scanner.js --mark-done <id>    Mark task as done
  node scanner.js --set-current <id>  Set task as current focus
  node scanner.js --help              Show this help

Examples:
  node scanner.js --mark-done l-s5
  node scanner.js --set-current l-t9
  node scanner.js --project loomiverse
`);
}

// ============================================
// MAIN
// ============================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  cmdHelp();
} else if (args.includes('--status')) {
  cmdStatus();
} else if (args.includes('--mark-done')) {
  const idx = args.indexOf('--mark-done');
  const taskId = args[idx + 1];
  if (!taskId) {
    console.error('❌ Missing task ID');
    process.exit(1);
  }
  cmdMarkDone(taskId);
} else if (args.includes('--set-current')) {
  const idx = args.indexOf('--set-current');
  const taskId = args[idx + 1];
  if (!taskId) {
    console.error('❌ Missing task ID');
    process.exit(1);
  }
  cmdSetCurrent(taskId);
} else if (args.includes('--project')) {
  const idx = args.indexOf('--project');
  const projectId = args[idx + 1];
  cmdScan(projectId);
} else {
  cmdScan();
}
