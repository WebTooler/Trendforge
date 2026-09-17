import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';

const prompt=`Title: Cloudflare Workers AI writer integration smoke test
Category: AI

EVIDENCE PACK — sole factual source for this test:
Publisher: Cloudflare Workers AI documentation
URL: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
Evidence: Cloudflare documents a REST API for running Workers AI models. The documented endpoint uses an account ID and API token, and a successful response contains a result object with a response field containing generated text. The documentation shows synchronous model execution through the Workers AI REST API.

Write a factual test article about this documented REST API behavior. Do not add facts beyond the supplied evidence. Return the required TrendForge JSON article structure.`;

const result=await generateWithTrendForgeWriter({prompt,category:'AI',expectedTitle:'Cloudflare Workers AI writer integration smoke test'});
if(result.provider!=='Cloudflare')throw new Error(`Cloudflare smoke test used unexpected provider: ${result.provider}`);
const draft=JSON.parse(result.text);
if(!draft.title||!draft.description||!draft.content)throw new Error('Cloudflare smoke test returned incomplete article JSON.');
console.log(`CLOUDFLARE_SMOKE_PASS provider=${result.provider}`);
console.log(`CLOUDFLARE_SMOKE_WORDS=${draft.content.trim().split(/\s+/).length}`);
console.log(`CLOUDFLARE_SMOKE_TITLE=${draft.title}`);
