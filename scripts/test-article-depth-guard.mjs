import assert from 'node:assert/strict';
import { assessArticleDepth } from './article-depth-guard.mjs';

const para='The supplied evidence provides concrete details about the development, including what changed, when it changed, the entities involved, and the directly reported effects. This gives readers enough substance to understand the development without adding unsupported context.';
const richPara=(topic)=>Array(5).fill(para+' The section adds concrete '+topic+' detail for readers and preserves the limits of the supplied evidence.').join('\n\n');
const richContent=['## Development',richPara('development'),'## Evidence',richPara('evidence'),'## Implications',richPara('implications'),'## Uncertainty',richPara('uncertainty'),'## Takeaway',richPara('takeaway')].join('\n\n');
const rich=assessArticleDepth({content:richContent,blueprint:{mode:'rich'}});
assert.equal(rich.passed,true);
const shallow=assessArticleDepth({content:'## Development\n\nThe report describes the launch.\n\n## Impact\n\nThe report describes an effect.',blueprint:{mode:'bounded'}});
assert.equal(shallow.passed,false);
assert.ok(shallow.errors.some(x=>x.includes('underdeveloped H2')||x.includes('too few substantive paragraphs')||x.includes('too shallow')));
const concentrated=assessArticleDepth({content:'## Main\n\n'+Array(110).fill('supported detail').join(' ')+'\n\n## Context\n\nA useful section adds context with concrete detail to explain the evidence clearly for readers.\n\n## Limits\n\nAnother section explains uncertainty and what the evidence does not establish for readers.',blueprint:{mode:'rich'}});
assert.equal(concentrated.passed,false);
assert.ok(concentrated.errors.some(x=>x.includes('overly concentrated')));
const narrowContent='## Evidence\n\n'+Array(8).fill(para).join('\n\n');
const narrow=assessArticleDepth({content:narrowContent,blueprint:{mode:'narrow'}});
assert.equal(narrow.passed,true);
console.log('Phase 9 article depth guard tests passed.');
