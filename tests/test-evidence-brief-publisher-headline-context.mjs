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
    'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96. The opening levels gave traders a concrete reference point for the latest market session and established the prices being tracked in this report.',
    'Bitcoin investors monitored exchange liquidity and order flow as the morning session developed, while traders compared the opening level with recent sessions, watched changes in market depth, and tracked activity across major cryptocurrency exchanges during the session.',
    'Ethereum trading volumes drew attention from market participants after the opening print, with investors tracking activity across exchanges, comparing the move with recent cryptocurrency sessions, and watching whether trading conditions changed as the market developed through the morning.',
    'Analysts tracked broader cryptocurrency activity while comparing the latest session with recent trading levels, including changes in bitcoin liquidity, ethereum volumes, and the behavior of other major digital assets as traders assessed the opening market conditions.',
    'The bitcoin and ethereum opening prices remained central reference points for the session, with market participants using the reported levels to compare later trading activity, exchange liquidity, and cryptocurrency market conditions.'
  ],
  body:'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96. The opening levels gave traders a concrete reference point for the latest market session and established the prices being tracked in this report.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.metrics.relevantPassageCount>=2,'publisher-headline wording should retain relevant passages');
assert.ok(brief.metrics.supportedClaimCount>=2,'publisher-headline wording should retain claim-grade evidence');
assert.ok(brief.metrics.relevantChars>=600,'publisher-headline evidence should retain substantive text');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$86,597.82')),'bitcoin opening price should survive evidence filtering');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$2,775.96')),'ethereum opening price should survive evidence filtering');
console.log('Evidence brief publisher-headline context: PASS');
