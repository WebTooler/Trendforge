import assert from 'node:assert/strict';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';

const html=`
<html><head>
<title>The fix for rogue AI agents could be more AI | TechCrunch</title>
<script type="application/ld+json">{"@type":"NewsArticle","headline":"The fix for rogue AI agents could be more AI","articleBody":"Companies are handing longer tasks to AI agents. Agents can act faster than humans can realistically review. Apollo launched Watcher in February. Watcher can route flagged activity to specialized monitors."}</script>
</head><body>
<p>25% off tickets now Back by popular demand: Save up to $300 on Disrupt</p>
<p>As companies hand off longer and more complex tasks to AI agents, they are running into an oversight problem.</p>
<p>Agents can act faster, longer, and at greater volume than humans can realistically review.</p>
<p>That issue reached a peak with the Hugging Face incident, which saw nearly 12,000 agents coordinating faster than human beings could track.</p>
<p>Subscribe to our newsletter and follow us for more.</p>
<p>Apollo Research launched an AI monitor called Watcher in February.</p>
</body></html>`;

const result=extractEvidenceFromHtml(html,'The fix for rogue AI agents could be more AI');
assert.ok(result.passages.length>=3,'expected multiple evidence passages');
assert.ok(result.selectedChars>200,'expected substantive evidence');
assert.ok(!result.passages.some(p=>/25% off|tickets now|subscribe to our newsletter/i.test(p)),'promotional content leaked into evidence');
assert.ok(result.passages.some(p=>/AI agents/i.test(p)),'story-specific evidence missing');
console.log('Evidence extraction test: PASS');
console.log(`passages=${result.passages.length} chars=${result.selectedChars} kind=${result.kind}`);
