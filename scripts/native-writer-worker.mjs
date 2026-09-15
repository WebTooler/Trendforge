import fs from 'node:fs';
import { generateNativeArticle } from './trendforge-native-writer-v24.mjs';

const inputPath='data/native-writer-worker-input.json';
const outputPath='data/native-writer-worker-output.json';
try {
  const payload=JSON.parse(fs.readFileSync(inputPath,'utf8'));
  const result=await generateNativeArticle({candidate:payload.candidate,existingTitles:new Set(payload.existingTitles||[])});
  fs.writeFileSync(outputPath,JSON.stringify(result)+'\n');
} catch(error) {
  fs.writeFileSync(outputPath,JSON.stringify({ok:false,reason:error?.message||String(error)})+'\n');
}
