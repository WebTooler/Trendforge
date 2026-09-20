import fs from 'node:fs';
import assert from 'node:assert/strict';

const path='data/authoritative-evidence-pack.json';
const original=fs.existsSync(path)?fs.readFileSync(path,'utf8'):null;
try{
  fs.writeFileSync(path,JSON.stringify({version:1,status:'authoritative',candidates:[{candidate:{title:'Quality fixture'},status:'authoritative',version:1,sources:[{id:'S1',url:'https://example.com/canonical',passages:['supported']}]}]},null,2));
  const root=JSON.parse(fs.readFileSync(path,'utf8'));
  const pack=root.candidates.find(x=>x.candidate.title==='Quality fixture');
  assert.ok(pack);
  assert.equal(pack.sources[0].url,'https://example.com/canonical');
  assert.equal(root.status,'authoritative');
  console.log('Phase 3 quality canonical evidence fixture passed.');
}finally{
  if(original===null)fs.rmSync(path,{force:true});else fs.writeFileSync(path,original);
}