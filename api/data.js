// ============================================
// COMMAND CENTER API — FULLY AUTOMATED
//
// Auto-discovers ALL repos from:
//   - nolimitjonesinc (personal)
//   - Nolimit-Labs-Projects (org)
//
// For each repo, scans file tree for PRD/roadmap
// markdown files, parses checklists, and builds
// project data. Zero manual config needed.
// ============================================

const GITHUB_SOURCES = [
  { type: 'user', name: 'nolimitjonesinc' },
  { type: 'org', name: 'Nolimit-Labs-Projects' }
];

// Files matching these patterns (case-insensitive) get parsed for checklists
const PRD_FILE_PATTERN = /(?:prd|roadmap|todo|checklist|tasks).*\.md$/i;

// Repos to skip (profile repos, test repos, auto-generated junk)
const SKIP_REPOS = new Set([
  'nolimitjonesinc',        // GitHub profile config
  'mockingbird-test',       // test repo
  'simple-hello-world-web-page-single-page-that-say', // auto-generated
  'Twitter-Bot',            // empty repo
  'Tagaroo',                // empty repo
]);

// Deterministic color palette — each repo gets a consistent color based on its name
const COLORS = [
  '#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#06b6d4',
  '#22c55e', '#f97316', '#ec4899', '#a855f7', '#14b8a6',
  '#e11d48', '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9',
  '#d946ef', '#fb923c', '#4ade80', '#38bdf8', '#c084fc'
];

function getColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// Friendly display name from repo name
function displayName(repoName) {
  return repoName
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// GITHUB API HELPERS
// ============================================

async function ghFetch(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CommandCenter/2.0'
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getAllRepos() {
  const allRepos = [];

  for (const source of GITHUB_SOURCES) {
    // Fetch both pages to ensure we get all repos
    const endpoint = source.type === 'org'
      ? `orgs/${source.name}/repos?per_page=100&sort=pushed&type=all`
      : `users/${source.name}/repos?per_page=100&sort=pushed&type=owner`;

    const repos = await ghFetch(endpoint);
    if (!repos || !Array.isArray(repos)) continue;

    for (const repo of repos) {
      if (repo.archived) continue;
      if (SKIP_REPOS.has(repo.name)) continue;

      allRepos.push({
        name: repo.name,
        fullName: repo.full_name,
        owner: source.name,
        description: repo.description || '',
        pushedAt: repo.pushed_at,
        defaultBranch: repo.default_branch,
        isOrg: source.type === 'org'
      });
    }
  }

  // Deduplicate by repo name (personal takes priority if somehow both have same name)
  const seen = new Set();
  return allRepos.filter(r => {
    if (seen.has(r.name.toLowerCase())) return false;
    seen.add(r.name.toLowerCase());
    return true;
  });
}

async function getFileTree(owner, repoName) {
  const data = await ghFetch(`repos/${owner}/${repoName}/git/trees/HEAD?recursive=1`);
  if (!data || !data.tree) return [];
  return data.tree.map(t => t.path);
}

async function getFileContent(owner, repoName, filePath) {
  const data = await ghFetch(`repos/${owner}/${repoName}/contents/${encodeURIComponent(filePath)}`);
  if (!data || !data.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function getRecentCommits(owner, repoName, count = 3) {
  return ghFetch(`repos/${owner}/${repoName}/commits?per_page=${count}`);
}

// ============================================
// CHECKLIST PARSER
// ============================================

function parseChecklists(content, fileName) {
  const lines = content.split('\n');
  const tasks = [];
  let currentHeading = fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ');

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
    }

    const checkMatch = line.match(/^[\s]*[-*]\s*\[([ xX])\]\s*(.+)/);
    if (checkMatch) {
      tasks.push({
        done: checkMatch[1].toLowerCase() === 'x',
        name: checkMatch[2].trim(),
        section: currentHeading
      });
    }
  }

  return tasks;
}

// ============================================
// BUILD PROJECT DATA
// ============================================

async function buildProjectData(repo, index) {
  const { name: repoName, owner, description, pushedAt } = repo;

  // Get file tree to find PRD files
  let prdFiles = [];
  try {
    const tree = await getFileTree(owner, repoName);
    prdFiles = tree.filter(f => PRD_FILE_PATTERN.test(f));
  } catch (e) {
    // Empty repo or no access — skip file tree
  }

  // Fetch PRD contents + recent commits in parallel
  const [prdResults, commits] = await Promise.all([
    Promise.all(
      prdFiles.map(async (file) => {
        const content = await getFileContent(owner, repoName, file);
        if (!content) return { file, tasks: [] };
        return { file, tasks: parseChecklists(content, file) };
      })
    ),
    getRecentCommits(owner, repoName)
  ]);

  // Build milestones from PRD checklists
  const milestones = [];
  for (const prd of prdResults) {
    if (prd.tasks.length === 0) continue;

    // Group by section heading
    const sections = {};
    for (const task of prd.tasks) {
      const section = task.section || prd.file;
      if (!sections[section]) sections[section] = [];
      sections[section].push(task);
    }

    for (const [sectionName, sectionTasks] of Object.entries(sections)) {
      const doneTasks = sectionTasks.filter(t => t.done).length;
      const allDone = doneTasks === sectionTasks.length;

      milestones.push({
        id: `${repoName}-${sectionName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
        name: sectionName,
        done: allDone,
        current: !allDone && milestones.every(m => m.done),
        source: prd.file,
        tasks: sectionTasks.map((t, i) => ({
          id: `${repoName}-m${milestones.length}-t${i}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: t.name,
          done: t.done,
          current: !t.done && sectionTasks.slice(0, i).every(st => st.done)
        }))
      });
    }
  }

  // No PRD checklists found — show recent commits as activity
  if (milestones.length === 0 && commits && commits.length > 0) {
    milestones.push({
      id: `${repoName}-activity`.toLowerCase(),
      name: 'Recent Activity',
      done: false,
      current: true,
      tasks: commits.slice(0, 5).map((c, i) => ({
        id: `${repoName}-c${i}`.toLowerCase(),
        name: c.commit.message.split('\n')[0].slice(0, 80),
        done: true
      }))
    });
  }

  // Mark first undone milestone as current
  if (!milestones.some(m => m.current)) {
    const firstUndone = milestones.find(m => !m.done);
    if (firstUndone) firstUndone.current = true;
  }

  // Determine status from activity
  const lastPush = pushedAt ? new Date(pushedAt) : null;
  const daysSinceUpdate = lastPush
    ? Math.floor((Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let status = 'active';
  if (daysSinceUpdate !== null) {
    if (daysSinceUpdate > 90) status = 'paused';
    else if (daysSinceUpdate > 30) status = 'idle';
  }

  // Count total checklist progress
  let totalItems = 0, doneItems = 0;
  for (const m of milestones) {
    for (const t of (m.tasks || [])) {
      totalItems++;
      if (t.done) doneItems++;
    }
  }

  return {
    id: repoName.toLowerCase(),
    name: displayName(repoName),
    description,
    status,
    priority: index,
    color: getColor(repoName),
    repo: `github.com/${owner}/${repoName}`,
    owner,
    prdFiles: prdFiles.length,
    lastCommit: commits && commits[0] ? {
      message: commits[0].commit.message.split('\n')[0],
      date: commits[0].commit.committer.date,
      sha: commits[0].sha.slice(0, 7)
    } : null,
    daysSinceUpdate,
    totalItems,
    doneItems,
    milestones
  };
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // Step 1: Discover all repos
    const repos = await getAllRepos();

    // Step 2: Build project data for each (in parallel batches of 5 to avoid rate limits)
    const projects = [];
    const batchSize = 8;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((repo, j) =>
          buildProjectData(repo, i + j).catch(() => null)
        )
      );
      projects.push(...results.filter(Boolean));
    }

    // Step 3: Sort — active repos with PRD checklists first, then by recent activity
    projects.sort((a, b) => {
      // Status priority: active > idle > paused
      const statusOrder = { active: 0, idle: 1, paused: 2 };
      const statusDiff = (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
      if (statusDiff !== 0) return statusDiff;

      // Repos with PRD checklists first
      const prdDiff = (b.prdFiles || 0) - (a.prdFiles || 0);
      if (prdDiff !== 0) return prdDiff;

      // Then by most recently pushed
      return (a.daysSinceUpdate || 999) - (b.daysSinceUpdate || 999);
    });

    const data = {
      meta: {
        lastUpdated: new Date().toISOString(),
        lastScanType: 'live-api',
        version: '3.0.0',
        projectCount: projects.length,
        sources: GITHUB_SOURCES.map(s => s.name)
      },
      projects
    };

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch project data',
      message: error.message
    });
  }
}
