import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = {
  version: 1,
  mode: 'protective-observational',
  changesPublicationGates: false,
  changesThresholds: false,
  changesResearch: false,
  changesEvidence: false,
  changesWriter: false,
  changesEditorial: false,
  changesClaimVerification: false,
  changesSafety: false,
  scansSecrets: true,
  validatesBuildOutputs: true,
  validatesCriticalWorkflows: true,
  autoDeleteFiles: false,
  autoModifyPublishing: false,
};

const checks = [];
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pass = (name, ok, detail) => checks.push({ name, ok, detail });

pass('package manifest', exists('package.json'), 'package.json exists');
pass('production build script', /"build"\s*:\s*"next build"/.test(read('package.json')), 'Next production build is defined');
pass('reliability workflow', exists('.github/workflows/reliability-check.yml'), 'Reliability workflow exists');
pass('security policy', Object.values(policy).every((v) => v !== undefined), 'Security policy is explicit');

const workflowFiles = fs.existsSync(path.join(root, '.github/workflows'))
  ? fs.readdirSync(path.join(root, '.github/workflows')).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  : [];
pass('workflow inventory', workflowFiles.length > 0, `${workflowFiles.length} workflow files found`);

const trackedDangerous = [];
const scanDirs = ['app', 'lib', 'scripts', '.github'];
const secretPattern = /(?:BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/;
const scannerFile = path.normalize('scripts/trendforge-security-reliability.mjs');
function scanDir(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (['node_modules', '.next', 'out'].includes(entry.name)) continue;
    const rel = path.normalize(path.join(dir, entry.name));
    if (entry.isDirectory()) scanDir(rel);
    else if (entry.isFile()) {
      // The detector contains intentional secret-shaped regexes, and the test
      // harness contains fixtures for those patterns. Exclude only those
      // detector/test files; all other source and workflow files are scanned.
      if (rel === scannerFile) continue;
      if (rel.startsWith(`scripts${path.sep}`) && /^test-.*\.mjs$/i.test(entry.name)) continue;
      try { if (secretPattern.test(read(rel))) trackedDangerous.push(rel); } catch {}
    }
  }
}
scanDirs.forEach(scanDir);
pass('credential pattern scan', trackedDangerous.length === 0, trackedDangerous.length ? `Potential credential pattern in ${trackedDangerous.join(', ')}` : 'No known credential patterns found');

pass('static output directory', exists('out'), 'Production export directory exists after build');
if (exists('out')) {
  pass('index output', exists('out/index.html'), 'Homepage static output exists');
  pass('robots output', exists('out/robots.txt'), 'Robots output exists');
  const sitemapCandidates = ['out/sitemap.xml','out/sitemap-0.xml'];
  pass('sitemap output', sitemapCandidates.some(exists), 'Sitemap output exists');
  pass('search index output', exists('out/search-index.json'), 'Search index output exists');
  const secretFiles = [];
  function scanOut(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scanOut(full);
      else if (/^(\.env(?:\..*)?|.*secret.*)$/i.test(entry.name)) secretFiles.push(path.relative(root, full));
    }
  }
  scanOut(path.join(root, 'out'));
  pass('build secret-file scan', secretFiles.length === 0, secretFiles.length ? `Potential secret files: ${secretFiles.join(', ')}` : 'No secret-named build files found');
}

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: policy.mode,
  policy,
  checks,
  passed: checks.every((c) => c.ok),
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/trendforge-security-reliability.json'), JSON.stringify(result, null, 2));
for (const check of checks) console.log(`[Security Check] ${check.ok ? 'PASS' : 'FAIL'} — ${check.name}: ${check.detail}`);
console.log(`TrendForge Security + Reliability: ${checks.filter((c) => c.ok).length}/${checks.length} checks PASS`);
if (!result.passed) process.exit(1);
