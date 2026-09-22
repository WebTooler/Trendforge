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
    'Market participants continued to watch bitcoin trading activity as investors assessed the latest move, while analysts tracked whether the opening prices would hold through the session.',
    'The cryptocurrency market remained active during the session, with bitcoin and ethereum among the most watched assets as investors compared the latest prices with recent trading levels.',
    'Analysts said the opening prices reflected the latest market conditions and continued to monitor trading activity as the session developed.'
  ],
  body:'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.metrics.relevantPassageCount>=2,'publisher-headline wording should retain relevant passages');
assert.ok(brief.metrics.supportedClaimCount>=2,'publisher-headline wording should retain claim-grade evidence');
assert.ok(brief.metrics.relevantChars>=600,'publisher-headline evidence should retain substantive text');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$86,597.82')),'bitcoin opening price should survive evidence filtering');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$2,775.96')),'ethereum opening price should survive evidence filtering');
console.log('Evidence brief publisher-headline context: PASS');
