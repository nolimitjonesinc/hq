const GITHUB_ORG = 'nolimitjonesinc';

// ============================================
// PROJECT CONFIG - which repos to track and how to display them
// ============================================

const PROJECT_CONFIG = {
  'Loomiverse-Online': {
    name: 'Loomiverse',
    emoji: '\u{1F4D6}',
    description: 'AI Interactive Storytelling',
    color: '#8b5cf6',
    priority: 1,
    status: 'active',
    prdFiles: ['PRD.md']
  },
  'Quiply': {
    name: 'Quiplee',
    emoji: '\u{1F4AC}',
    description: 'Chrome Extension for Social Replies',
    color: '#3b82f6',
    priority: 2,
    status: 'live',
    prdFiles: ['PRD_Quiply_Enhancement.md', 'PRD_REPLY_BOOSTER_COMPLETION.md']
  },
  'mockingbirdnews': {
    name: 'MockingBird News',
    emoji: '\u{1F4F0}',
    description: 'News Aggregation Platform',
    color: '#ef4444',
    priority: 3,
    status: 'active',
    prdFiles: ['MBN create-prd.md', 'article-summarization-enhancement-prd.md', 'tweet-carousel-prd.md']
  },
  'Genesis-Engine': {
    name: 'Genesis Engine',
    emoji: '\u{1F9EC}',
    description: 'Procedural Character Generator',
    color: '#f59e0b',
    priority: 4,
    status: 'active',
    prdFiles: ['ROADMAP.md']
  },
  'tweetminer': {
    name: 'TweetMiner',
    emoji: '\u{26CF}\u{FE0F}',
    description: 'Reply Analysis for Product Ideas',
    color: '#06b6d4',
    priority: 5,
    status: 'live',
    prdFiles: ['tweetminer/README.md']
  },
  'Gaurdian': {
    name: 'Guardian',
    emoji: '\u{1F6E1}\u{FE0F}',
    description: 'Security & Protection System',
    color: '#22c55e',
    priority: 6,
    status: 'active',
    prdFiles: ['README.md']
  },
  'EmbersInc': {
    name: 'Embers Inc',
    emoji: '\u{1F525}',
    description: 'Embers Inc Project',
    color: '#f97316',
    priority: 7,
    status: 'active',
    prdFiles: ['README.md']
  },
  'DJ-Brain': {
    name: 'DJ Brain',
    emoji: '\u{1F9E0}',
    description: 'AI Knowledge System',
    color: '#ec4899',
    priority: 8,
    status: 'active',
    prdFiles: []
  },
  'MASTER_MockingBirdApp': {
    name: 'MockingBird App',
    emoji: '\u{1F4F1}',
    description: 'Main iOS App',
    color: '#a855f7',
    priority: 9,
    status: 'paused',
    prdFiles: ['DETAILED_IMPROVEMENT_PRD.md']
  }
};

// ============================================
// GITHUB API HELPERS
// ============================================

async function ghFetch(path) {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CommandCenter/1.0'
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getRepoInfo(repoName) {
  return ghFetch(`repos/${GITHUB_ORG}/${repoName}`);
}

async function getRecentCommits(repoName, count = 5) {
  return ghFetch(`repos/${GITHUB_ORG}/${repoName}/commits?per_page=${count}`);
}

async function getFileContent(repoName, filePath) {
  const data = await ghFetch(`repos/${GITHUB_ORG}/${repoName}/contents/${encodeURIComponent(filePath)}`);
  if (!data || !data.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function getOpenIssues(repoName) {
  return ghFetch(`repos/${GITHUB_ORG}/${repoName}/issues?state=open&per_page=10`);
}

async function getOpenPRs(repoName) {
  return ghFetch(`repos/${GITHUB_ORG}/${repoName}/pulls?state=open&per_page=10`);
}

// ============================================
// CHECKLIST PARSER
// ============================================

function parseChecklists(content, fileName) {
  const lines = content.split('\n');
  const tasks = [];
  let currentHeading = fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ');

  for (const line of lines) {
    // Track headings for grouping
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
    }

    // Parse checklist items: - [ ] or - [x] or * [ ] etc.
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

async function buildProjectData(repoName, config) {
  const [repoInfo, commits, issues, prs] = await Promise.all([
    getRepoInfo(repoName),
    getRecentCommits(repoName),
    getOpenIssues(repoName),
    getOpenPRs(repoName)
  ]);

  if (!repoInfo) {
    return null;
  }

  // Fetch and parse PRD files in parallel
  const prdResults = await Promise.all(
    config.prdFiles.map(async (file) => {
      const content = await getFileContent(repoName, file);
      if (!content) return { file, tasks: [] };
      return { file, tasks: parseChecklists(content, file) };
    })
  );

  // Group tasks by section into milestones
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
        id: `${repoName}-${sectionName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
        name: sectionName,
        done: allDone,
        current: !allDone && milestones.every(m => m.done),
        source: prd.file,
        tasks: sectionTasks.map((t, i) => ({
          id: `${repoName}-t${milestones.length}-${i}`,
          name: t.name,
          done: t.done,
          current: !t.done && sectionTasks.slice(0, i).every(st => st.done)
        }))
      });
    }
  }

  // If no milestones from PRDs, create a simple one from repo activity
  if (milestones.length === 0 && commits && commits.length > 0) {
    milestones.push({
      id: `${repoName}-activity`,
      name: 'Recent Activity',
      done: false,
      current: true,
      tasks: commits.slice(0, 5).map((c, i) => ({
        id: `${repoName}-commit-${i}`,
        name: c.commit.message.split('\n')[0].slice(0, 80),
        done: true,
        aiTime: null
      }))
    });
  }

  // Mark first undone milestone as current
  const hasCurrentMilestone = milestones.some(m => m.current);
  if (!hasCurrentMilestone) {
    const firstUndone = milestones.find(m => !m.done);
    if (firstUndone) firstUndone.current = true;
  }

  // Calculate days since last commit
  const lastPush = repoInfo.pushed_at ? new Date(repoInfo.pushed_at) : null;
  const daysSinceUpdate = lastPush ? Math.floor((Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Determine status from config or activity
  let status = config.status || 'active';
  if (daysSinceUpdate !== null && daysSinceUpdate > 30 && status === 'active') {
    status = 'paused';
  }

  return {
    id: repoName.toLowerCase(),
    name: config.name,
    emoji: config.emoji,
    description: config.description || repoInfo.description || '',
    status,
    priority: config.priority,
    color: config.color,
    repo: `github.com/${GITHUB_ORG}/${repoName}`,
    lastCommit: commits && commits[0] ? {
      message: commits[0].commit.message.split('\n')[0],
      date: commits[0].commit.committer.date,
      sha: commits[0].sha.slice(0, 7)
    } : null,
    openIssues: issues ? issues.length : 0,
    openPRs: prs ? prs.filter(p => !p.draft).length : 0,
    daysSinceUpdate,
    milestones
  };
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // Build all projects in parallel
    const projectEntries = Object.entries(PROJECT_CONFIG);
    const projects = (await Promise.all(
      projectEntries.map(([repo, config]) => buildProjectData(repo, config))
    )).filter(Boolean);

    // Sort by priority
    projects.sort((a, b) => a.priority - b.priority);

    const data = {
      meta: {
        lastUpdated: new Date().toISOString(),
        lastScanType: 'live-api',
        version: '2.0.0',
        projectCount: projects.length
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
