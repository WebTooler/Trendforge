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
    'Bitcoin opened at $86,597.82 on Tuesday while Ethereum started at $2,775.96, establishing the two reported reference prices used by traders to describe the opening conditions and giving readers concrete figures for the latest cryptocurrency update.',
    'Bitcoin order-flow activity was closely watched during the morning as exchange liquidity changed across venues, while Ethereum liquidity indicators gave participants another measure for assessing how trading conditions developed after the published opening figures.',
    'Bitcoin derivatives desks tracked positioning and funding signals separately from the cash market, while Ethereum spot activity provided another stream of observable information that traders used when comparing cryptocurrency conditions during the session.',
    'Bitcoin exchange balances and reported transaction activity supplied additional market context, while Ethereum volume readings helped participants assess whether later trading activity was consistent with the conditions described around the published opening prices.'
  ],
  body:'Bitcoin opened at $86,597.82 on Tuesday while Ethereum started at $2,775.96, establishing the two reported reference prices used by traders to describe the opening conditions.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.metrics.relevantPassageCount>=2,'publisher-headline wording should retain relevant passages');
assert.ok(brief.metrics.supportedClaimCount>=2,'publisher-headline wording should retain claim-grade evidence');
assert.ok(brief.metrics.relevantChars>=600,'publisher-headline evidence should retain substantive text');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$86,597.82')),'bitcoin opening price should survive evidence filtering');
assert.ok(brief.supportedClaims.some(c=>c.text.includes('$2,775.96')),'ethereum opening price should survive evidence filtering');
console.log('Evidence brief publisher-headline context: PASS');
