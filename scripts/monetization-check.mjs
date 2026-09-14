import fs from 'node:fs';

const outputPath='data/monetization-readiness.json';
const clientId=process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID||'';
const publisherId=process.env.ADSENSE_PUBLISHER_ID||'';
const checks=[
  {name:'AdSense client configuration',ok:/^ca-pub-[0-9]+$/.test(clientId)},
  {name:'AdSense publisher configuration',ok:/^pub-[0-9]+$/.test(publisherId)},
  {name:'ads.txt',ok:fs.existsSync('public/ads.txt')},
  {name:'site privacy page',ok:fs.existsSync('app/privacy/page.tsx')||fs.existsSync('pages/privacy.tsx')||fs.existsSync('content/privacy.md')},
];
const result={version:1,generatedAt:new Date().toISOString(),mode:'readiness_only',checks,readyForAdSenseFoundation:checks.every(c=>c.ok),note:'Actual AdSense approval, crawling and ad serving remain controlled by Google and are not simulated by the pipeline.'};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2));
console.log(`Monetization readiness: ${result.readyForAdSenseFoundation?'PASS':'CHECK REQUIRED'} (${checks.filter(c=>c.ok).length}/${checks.length}).`);
