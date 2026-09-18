import assert from 'node:assert/strict';
import { buildEvidenceArticlePrompt } from './evidence-article-prompt.mjs';

const base='BASE ARTICLE PROMPT';

const rich={
  mode:'rich',
  targetWords:{min:700,max:1000,soft:850},
  h2Guidance:{preferredMin:3,preferredMax:5,writerDecides:true,noPadding:true},
  maxH2:5,
  requireCrossCheck:true,
  allowContextSection:true,
  instruction:'Build a full evidence-led article.'
};
const richPrompt=buildEvidenceArticlePrompt(base,rich);
console.log('richPrompt=',richPrompt);
assert.match(richPrompt,/Word guidance: 700-1000 words, with a soft target around 850/);
assert.match(richPrompt,/prefer 3-5 distinct H2 sections/);
assert.match(richPrompt,/writer decides the actual H2 count and section titles/i);
assert.match(richPrompt,/H2 minimum is not a hard requirement/i);
assert.match(richPrompt,/Maximum H2 count: 5/);
assert.match(richPrompt,/Never create an H2 merely to satisfy a count/i);
assert.match(richPrompt,/Cross-check material developments/i);
assert.match(richPrompt,/Context explicitly supported by the evidence may be included/i);

const usable={
  mode:'bounded',
  targetWords:{min:450,max:750,soft:600},
  h2Guidance:{preferredMin:2,preferredMax:4,writerDecides:true,noPadding:true},
  maxH2:4,
  requireCrossCheck:false,
  allowContextSection:false,
  instruction:'Write a bounded evidence-led article.'
};
const usablePrompt=buildEvidenceArticlePrompt(base,usable);
assert.match(usablePrompt,/Word guidance: 450-750 words, with a soft target around 600/);
assert.match(usablePrompt,/prefer 2-4 distinct H2 sections/);
assert.match(usablePrompt,/writer decides the actual H2 count/i);
assert.match(usablePrompt,/Maximum H2 count: 4/);
assert.match(usablePrompt,/Use only the supplied evidence and preserve attribution/i);
assert.match(usablePrompt,/Do not add a separate context section/i);

const blockedPrompt=buildEvidenceArticlePrompt(base,{
  mode:'blocked',
  targetWords:{min:0,max:0,soft:0},
  h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},
  maxH2:0,
  requireCrossCheck:false,
  allowContextSection:false,
  instruction:'Do not generate a publishable article.'
});
assert.match(blockedPrompt,/Do not generate a publishable article/i);

console.log('Evidence-aware article prompt construction test: PASS');
