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
    'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96.',
    'Market participants continued to watch bitcoin trading activity as investors assessed the latest move.',
    'The cryptocurrency market remained active during the session, with bitcoin and ethereum among the most watched assets.',
    'Analysts said the opening prices reflected the latest market conditions.'
  ],
  body:'Bitcoin opened at $86,597.82 on Tuesday, while Ethereum started the session at $2,775.96.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.metrics.relevantPassageCount>=3,'publisher-headline wording should retain relevant passages');
assert.ok(brief.metrics.supportedClaimCount>=3,'publisher-headline wording should retain claim-grade evidence');
assert.ok(brief.metrics.relevantChars>=1200,'evidence should have enough text for downstream fact capacity');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$86,597.82')),'bitcoin opening price should survive evidence filtering');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$2,775.96')),'ethereum opening price should survive evidence filtering');
console.log('Evidence brief publisher-headline context: PASS');
