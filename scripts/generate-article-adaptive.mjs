import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const scoredPath = 'data/scored-trends.json';
const articlesDir = 'content/articles';

if (!fs.existsSync(scoredPath)) {
  console.log(`No ${scoredPath}; nothing to publish.`);
  process.exit(0);
}

const original = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
const trends = original.trends ?? [];
const preferredFallbackCategories = new Set(['How-To', 'Technology', 'Innovation', 'Product Launches', 'Digital Life', 'AI', 'Crypto']);

const before = new Set(
  fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md'))
    : [],
);

const ranked = [...trends]
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .filter((candidate, index, all) => all.findIndex((item) => item.link === candidate.link) === index);

const primary = ranked.filter((item) => item.eligible);
const fallback = ranked.filter((item) => !item.eligible && preferredFallbackCategories.has(item.category));
const queue = [...primary, ...fallback].slice(0, 12);

console.log(`Adaptive publishing queue: ${queue.length} candidate(s).`);

let published = false;
let attempted = 0;

for (const candidate of queue) {
  attempted += 1;
  const attemptTrends = trends.map((item) => ({ ...item, eligible: item.link === candidate.link }));
  fs.writeFileSync(scoredPath, JSON.stringify({ ...original, trends: attemptTrends }, null, 2));
  console.log(`Attempt ${attempted}/${queue.length}: ${candidate.category} — ${candidate.title}`);

  const result = spawnSync('npx', ['tsx', 'scripts/generate-article.ts'], {
    stdio: 'inherit',
    env: process.env,
  });

  const after = new Set(
    fs.existsSync(articlesDir)
      ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md'))
      : [],
  );
  const newArticle = [...after].find((name) => !before.has(name));

  if (newArticle) {
    console.log(`Adaptive queue published: ${newArticle}`);
    published = true;
    break;
  }

  if (result.error) console.log(`Candidate attempt failed to execute: ${result.error.message}`);
  console.log('Candidate did not produce a publishable article; moving to the next candidate.');
}

// Restore the research output before any fallback work so later pipeline steps see the real research data.
fs.writeFileSync(scoredPath, JSON.stringify(original, null, 2));

// Last-resort evergreen/current fallback. This is deliberately source-backed and deterministic so
// publishing does not depend on an AI provider being available. It is only used when every researched
// candidate fails the normal generator gates. Each fallback is used at most once by title.
const existingTitles = new Set(
  fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md')).map((name) => {
        const raw = fs.readFileSync(`${articlesDir}/${name}`, 'utf8');
        return (raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1] || '').toLowerCase().trim();
      })
    : [],
);

const evergreenFallbacks = [
  {
    title: 'How to Move Passwords and Passkeys Between Managers on Android',
    description: 'Android now offers a safer way to move passwords and passkeys between supported password managers without first creating a downloadable credential file. Here is how the new transfer flow works and what to check before switching.',
    category: 'How-To',
    sources: [
      { title: 'Google: Switching password managers is easy and safe on Android', url: 'https://blog.google/products-and-platforms/platforms/android/switch-password-managers/' },
      { title: 'TechCrunch: Google is making it easier to switch between password managers on Android', url: 'https://techcrunch.com/2026/09/10/google-is-making-it-easier-to-switch-between-password-managers-on-android/' },
    ],
    content: `## Why the new transfer flow matters\n\nChanging password managers has traditionally involved a trade-off. Passwords could often be exported, but that could mean creating a file containing sensitive credentials. Passkeys were even harder to move between managers, which could make switching providers feel like a permanent commitment.\n\nGoogle says Android now provides a system-level transfer experience that can move passwords and passkeys directly between supported credential managers. The company says the process avoids the need to download a file first. TechCrunch independently reported the same launch and described the flow as a way to move both passwords and passkeys between supported apps.\n\n## How to start a transfer\n\nThe process begins inside the password manager you want to use. Look for its import or copy option for passwords and passkeys. The manager then hands the transfer over to Android.\n\nAndroid detects compatible password managers already available on the device and shows the managers that can participate. You can then select the source manager and continue the transfer.\n\nThe important point is that you should start from the destination manager rather than randomly exporting your vault first. That keeps you inside the supported transfer flow and avoids creating an unnecessary credential file.\n\n## Review before you authorize\n\nBefore the transfer completes, Android brings you back to the existing password manager so you can select, review and authorize what is being moved. Take a moment to check the source and destination before confirming.\n\nGoogle says the experience is already available with Google Password Manager, 1Password, Bitwarden Password Manager and Dashlane, with more partners expected to follow. Google also says the feature is compatible with Android 8 and newer devices. Availability can still depend on whether the password manager you use supports the transfer experience.\n\n## What to do before switching\n\nFirst, make sure both password managers are installed and that you can unlock or authenticate to the existing manager. Second, update the apps if updates are available. Third, review the accounts and credentials you actually need to move rather than treating the transfer as a reason to keep unnecessary data.\n\nIf your current manager does not appear as an available source, do not assume something is wrong with your phone. The transfer system depends on participating password managers, so an unsupported combination may still require the provider's existing migration process.\n\nThe bigger lesson is simple: portability is becoming part of credential security. A password manager is easier to trust when users can change providers without creating avoidable exposure or rebuilding every passkey by hand.`
  },
  {
    title: 'How to Update Android Apps Safely and Keep Them Current',
    description: 'Keeping Android apps updated can bring security fixes, bug fixes and new features. This practical guide explains how to check for updates manually and configure automatic updates in Google Play.',
    category: 'How-To',
    sources: [
      { title: 'Google Play Help: How to update apps on Android', url: 'https://support.google.com/googleplay/answer/113412' },
      { title: 'Android Authority: How to update apps on your Android phone', url: 'https://www.androidauthority.com/how-to-update-apps-on-android-3265904/' },
    ],
    content: `## Why app updates matter\n\nAn app update is not only about getting a new interface or feature. Google Play Help notes that updating Android apps gives users access to newer features and can improve security and stability. Android Authority likewise recommends keeping apps current because updates can include bug fixes and security patches.\n\nThat makes app maintenance a simple habit worth keeping, especially for apps you use for communication, payments, work or personal information.\n\n## How to update apps manually\n\nOpen the Google Play Store and tap your profile picture. Choose **Manage apps & device**, then look for the available updates section. You can review the list and update a single app or use the option to update all available apps.\n\nUpdating individually is useful when you want to see what is changing or when you need to limit downloads. Updating everything is more convenient when you simply want your installed apps brought up to date.\n\n## How to turn on automatic updates\n\nGoogle Play also provides automatic update settings. Open the Play Store, tap your profile picture, go to **Settings**, then **Network preferences** and **Auto-update apps**. Depending on your needs, you can choose whether updates use Wi-Fi or mobile data, or disable automatic updates.\n\nIf mobile data is limited, Wi-Fi-only updating can be a practical choice. If you prefer not to manage updates manually, allowing automatic updates can reduce the chance that important fixes remain pending.\n\n## A few checks before updating\n\nIf your phone has very little free storage, an update may not complete. Check storage when updates repeatedly fail. Also remember that some updates can introduce permission changes, so review prompts when an app asks for new permissions.\n\nIf an app is important to you, updating it regularly is usually simpler than waiting until it stops working. The goal is not to chase every new feature; it is to keep the software you depend on maintained, stable and reasonably secure.`
  },
  {
    title: 'How to Set Up a Passkey for Your Google Account',
    description: 'Passkeys let you sign in to a Google Account using your device screen lock, fingerprint or face unlock. Here is how to create one and the security checks to make before using it.',
    category: 'How-To',
    sources: [
      { title: 'Google Account Help: Sign in with a passkey instead of a password', url: 'https://support.google.com/accounts/answer/13548313?hl=en' },
      { title: 'Google Security Blog: 5 helpful tools from Google to keep your accounts safe', url: 'https://blog.google/innovation-and-ai/technology/safety-security/world-password-day-2026/' },
    ],
    content: `## What a passkey changes\n\nA passkey gives you another way to sign in without typing a traditional password. Google Account Help says a passkey can use a fingerprint, face scan or phone screen lock such as a PIN. The biometric information used to unlock the device stays on the device rather than being shared with Google.\n\nPasskeys are designed to make sign-in easier while providing stronger protection against phishing than a password alone. Google also continues to support other account recovery and security methods, so creating a passkey does not simply erase the rest of your account protections.\n\n## How to create a passkey\n\nStart from your Google Account sign-in options and open the passkeys section. Google provides the direct setup path at **myaccount.google.com/signinoptions/passkeys**. Choose **Create a passkey** and follow the device's instructions to verify that you own and can unlock it.\n\nBefore creating one, make sure you are using a personal device that you control. Google specifically warns against creating a passkey on a shared device because anyone who can unlock that device could potentially use the passkey.\n\n## What you should check first\n\nYour phone or computer needs a supported operating system and browser, and your device should have a screen lock enabled. If you are setting up a passkey on a phone for use with another computer, Bluetooth may also be required for the cross-device sign-in flow.\n\nIt is also worth keeping your existing recovery information current. A passkey is convenient, but account recovery still matters if a device is lost or replaced.\n\n## When a passkey is a good choice\n\nFor people who regularly use a modern phone or computer, a passkey can reduce password fatigue while making phishing harder. Google says passkeys are now one of the tools it recommends alongside protections such as 2-Step Verification and recovery options.\n\nThe safest approach is not to treat a passkey as a magic replacement for every security measure. Use a personal, protected device, keep recovery methods current and review the passkeys listed in your Google Account from time to time.`
  }
];

for (const fallbackArticle of evergreenFallbacks) {
  if (existingTitles.has(fallbackArticle.title.toLowerCase().trim())) continue;
  const wordCount = fallbackArticle.content.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const headings = (fallbackArticle.content.match(/^##\s+/gm) || []).length;
  if (wordCount < 150 || headings < 2 || fallbackArticle.description.length < 80) continue;

  const slug = fallbackArticle.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
  const markdown = `---\ntitle: "${fallbackArticle.title}"\ndescription: "${fallbackArticle.description}"\nslug: "${slug}"\ncategory: "${fallbackArticle.category}"\nauthor: "Tejendra Pal Singh"\npublishedAt: "${new Date().toISOString()}"\n---\n\n${fallbackArticle.content.trim()}\n\n## Sources\n\n${fallbackArticle.sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n`;
  fs.mkdirSync(articlesDir, { recursive: true });
  fs.writeFileSync(`${articlesDir}/${slug}.md`, markdown);
  console.log(`Evergreen fallback published without AI provider: ${slug}`);
  published = true;
  break;
}

if (!published) {
  console.log('Adaptive queue and evergreen fallback exhausted without a publishable article. Pipeline continues without publishing low-quality content.');
}
