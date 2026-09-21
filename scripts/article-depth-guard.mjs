const wordCount=(text='')=>String(text).trim().split(/\s+/).filter(Boolean).length;
const sentenceCount=(text='')=>(String(text).match(/[.!?](?:\s|$)/g)||[]).length;
const sections=(content='')=>String(content).split(/^##\s+.+$/m).slice(1).map(s=>s.trim()).filter(Boolean);
const paragraphCount=(content='')=>String(content).replace(/^##\s+.+$/gm,'\n\n').split(/\n\s*\n/).map(p=>p.trim()).filter(p=>p&&wordCount(p)>=25).length;

export function assessArticleDepth({content='',blueprint=null}={}){
  const words=wordCount(content);
  const h2=(String(content).match(/^##\s+.+$/gm)||[]).length;
  const sectionBodies=sections(content);
  const sectionWords=sectionBodies.map(wordCount);
  const mode=String(blueprint?.mode||'default');
  const baseRules={rich:{minWords:650,minH2:0,minSectionWords:70,minSubstantiveParagraphs:5,minSentences:12},bounded:{minWords:425,minH2:0,minSectionWords:60,minSubstantiveParagraphs:4,minSentences:10},narrow:{minWords:220,minH2:0,minSectionWords:0,minSubstantiveParagraphs:2,minSentences:0},default:{minWords:300,minH2:0,minSectionWords:0,minSubstantiveParagraphs:0,minSentences:0}}[mode]||{minWords:300,minH2:0,minSectionWords:50,minSubstantiveParagraphs:3,minSentences:8};
  const blueprintMin=Number(blueprint?.targetWords?.min||baseRules.minWords);
  const rules={...baseRules,minWords:Math.max(0,blueprintMin),minSubstantiveParagraphs:mode==='narrow'?(blueprintMin>=280?2:1):baseRules.minSubstantiveParagraphs};
  const thinSections=sectionWords.filter(n=>n<rules.minSectionWords).length;
  const substantiveParagraphs=paragraphCount(content);
  const sentences=sentenceCount(content);
  const errors=[];
  if(words<rules.minWords) errors.push('article depth is too shallow for '+mode+' evidence ('+words+' words; minimum '+rules.minWords+')');
  
  if((mode==='rich'||mode==='bounded')&&sectionBodies.length&&thinSections>0) errors.push('article contains '+thinSections+' underdeveloped H2 section(s) below '+rules.minSectionWords+' words');
  if(substantiveParagraphs<rules.minSubstantiveParagraphs) errors.push('article depth has too few substantive paragraphs ('+substantiveParagraphs+'; minimum '+rules.minSubstantiveParagraphs+')');
  if(sentences<rules.minSentences&&words>=rules.minWords) errors.push('article depth has too few complete sentences ('+sentences+'; minimum '+rules.minSentences+')');
  const largest=sectionWords.length?Math.max(...sectionWords):0;
  const concentration=words>0?largest/words:0;
  if((mode==='rich'||mode==='bounded')&&sectionWords.length>=3&&concentration>0.72) errors.push('article depth is overly concentrated in one section ('+Math.round(concentration*100)+'%)');
  return {passed:errors.length===0,mode,words,h2,sectionWords,thinSections,substantiveParagraphs,sentences,largestSectionShare:concentration,rules,errors};
}
export function validateArticleDepth(input={}){return assessArticleDepth(input);}
