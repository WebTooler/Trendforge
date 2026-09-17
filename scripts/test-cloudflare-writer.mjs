import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';

const prompt=`Title: Cloudflare Workers AI writer integration smoke test
Category: AI

EVIDENCE PACK — sole factual source for this test:
Publisher: Cloudflare Workers AI documentation
URL: https://developers.cloudflare.com/workers-ai/get-started/rest-api/

Evidence passage 1 — REST setup: Cloudflare's Workers AI REST API requires an API token and an Account ID. The documentation says the API token can be created from the Workers AI page using the REST API flow. For a custom token, Cloudflare says the token needs both Workers AI - Read and Workers AI - Edit permissions.

Evidence passage 2 — model execution: Cloudflare documents an Execute AI model endpoint in the form https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}. The request authenticates with a Bearer API token. The documentation demonstrates running a Workers AI model through this endpoint and says the model identifier can be replaced with another model from the Workers AI models catalog.

Evidence passage 3 — response: A successful REST request returns a JSON response with a result object. In the documented example, result.response contains the generated text, while success is true and errors and messages are empty arrays.

Evidence passage 4 — current model example: Cloudflare's documentation for @cf/meta/llama-3.3-70b-instruct-fp8-fast identifies it as a Cloudflare-hosted Meta text-generation model, quantized to FP8 precision and optimized for faster inference. The model page documents a 24,000-token context window and synchronous generation. It also documents messages input, max_tokens, temperature, top_p, top_k, seed, repetition_penalty, frequency_penalty and presence_penalty parameters.

Evidence passage 5 — compatibility: Cloudflare documents OpenAI-compatible endpoints for Workers AI text generation, including /v1/chat/completions. The documented OpenAI-compatible base URL is https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1 and the model name is supplied in the request body.

Write a useful, factual 500-700 word test article explaining how the documented Cloudflare Workers AI REST integration works, using 3-5 H2 sections. You may paraphrase and synthesize only the supplied evidence passages. Do not add any fact from model memory or outside knowledge. Do not pad with repetition. Return the required TrendForge JSON article structure.`;

const result=await generateWithTrendForgeWriter({prompt,category:'AI',expectedTitle:'Cloudflare Workers AI writer integration smoke test'});
if(result.provider!=='Cloudflare')throw new Error(`Cloudflare smoke test used unexpected provider: ${result.provider}`);
const draft=JSON.parse(result.text);
if(!draft.title||!draft.description||!draft.content)throw new Error('Cloudflare smoke test returned incomplete article JSON.');
console.log(`CLOUDFLARE_SMOKE_PASS provider=${result.provider}`);
console.log(`CLOUDFLARE_SMOKE_WORDS=${draft.content.trim().split(/\s+/).length}`);
console.log(`CLOUDFLARE_SMOKE_TITLE=${draft.title}`);
