import assert from 'node:assert/strict';
import { buildEditorialEvidenceBrief } from '../scripts/editorial-evidence-brief.mjs';

const candidate={
  title:'Bitcoin and ethereum prices today',
  description:'Live market prices and developments for bitcoin and ethereum.'
};

const sources=[{
  url:'https://finance.example.com/crypto',
  domain:'finance.example.com',
  publisherFamily:'example.com',
  title:'Bitcoin opens at $86,597.82 as Ethereum starts at $2,775.96',
  passages:[
    'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96, giving traders a clear reference point for the opening of the latest market session.',
    'Bitcoin investors monitored exchange liquidity and order flow as the morning session developed, while traders compared the opening level with recent sessions and watched for changes in market depth across major exchanges.',
    'Ethereum trading volumes drew attention from market participants after the opening print, with investors tracking activity across exchanges and comparing the move with recent cryptocurrency sessions and broader market conditions.',
    'Analysts tracked broader cryptocurrency activity while comparing the latest session with recent trading levels, including changes in bitcoin liquidity, ethereum volumes, and the behavior of other major digital assets during the session.'
  ],
  body:'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96. Bitcoin investors monitored exchange liquidity and order flow as the morning session developed, while traders compared the opening level with recent sessions and watched for changes in market depth across major exchanges.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.metrics.relevantPassageCount>=2,'publisher-headline wording should retain relevant passages');
assert.ok(brief.metrics.supportedClaimCount>=2,'publisher-headline wording should retain claim-grade evidence');
assert.ok(brief.metrics.relevantChars>=600,'publisher-headline evidence should retain substantive text');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$86,597.82')),'bitcoin opening price should survive evidence filtering');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$2,775.96')),'ethereum opening price should survive evidence filtering');
console.log('Evidence brief publisher-headline context: PASS');
