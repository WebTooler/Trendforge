const GENERIC_AI_PATTERNS=[
  /\b(?:in today's|in the ever-evolving|in an ever-changing|in the modern) (?:world|landscape|era)\b/i,
  /\b(?:this article|this piece) (?:explores|examines|delves into|takes a closer look)\b/i,
  /\b(?:let's take a closer look|let us take a closer look)\b/i,
  /\b(?:it is important to note|it's important to note|it is worth noting|it's worth noting)\b/i,
  /\b(?:there are several key|there are a number of) (?:factors|reasons|things|ways)\b/i,
  /\b(?:plays? a (?:key|crucial|vital|important) role)\b/i,
  /\b(?:marks?|usher(?:s|ing)? in) (?:a|an) (?:new|important|exciting) era\b/i,
  /\b(?:at the end of the day|when all is said and done)\b/i,
  /\b(?:overall|ultimately),? (?:it is|it's) (?:clear|important|worth)\b/i,
  /\b(?:seamlessly|effortlessly) (?:integrat|connect|blend|combine)\w*\b/i,
  /\b(?:unlock(?:s|ing)?|harness(?:es|ing)?) (?:the )?(?:power|potential)\b/i,
  /\b(?:game[- ]changer|game[- ]changing|revolutionary|groundbreaking)\b/i
];
const FIRST_PERSON_EXPERIENCE=/\b(?:i|we)\s+(?:tested|tried|used|verified|confirmed|experienced|found|saw|noticed|observed)\b/i;
const AUDIENCE_META=/\b(?:if you're|if you are|whether you're|whether you are)\s+(?:a|an)\s+(?:beginner|expert|developer|investor|reader|user)\b/i;
const SENTENCE_START_STOPWORDS=new Set(['the','a','an','this','that','it','there','these','those','according','however','but','while','because','for','as','in','on','after','before']);
const sentenceList=(text='')=>String(text).match(/[^.!?]+[.!?](?:\s|$)/g)||[];
const sentenceStarterSignature=(text='')=>{const counts=new Map();for(const raw of sentenceList(text)){const words=raw.trim().toLowerCase().replace(/[^a-z0-9\\s'-]/g,'').split(/\\s+/).filter(Boolean);if(words.length<5)continue;const first=words.slice(0,2).join(' ');if(SENTENCE_START_STOPWORDS.has(words[0]))continue;counts.set(first,(counts.get(first)||0)+1);}return counts;};
export function assessHumanization(text=''){
 const value=String(text);const genericPatterns=GENERIC_AI_PATTERNS.filter(r=>r.test(value));const firstPerson=FIRST_PERSON_EXPERIENCE.test(value);const audienceMeta=AUDIENCE_META.test(value);const starts=sentenceStarterSignature(value);const repeatedStarts=[...starts.entries()].filter(([,count])=>count>=3);return {genericHits:genericPatterns.length,genericPatterns:genericPatterns.map(r=>r.source),firstPersonExperience:firstPerson,audienceMeta,repeatedSentenceStarts:repeatedStarts,blocked:genericPatterns.length>=2||firstPerson||audienceMeta||repeatedStarts.length>0};
}
export function validateHumanization({title='',description='',content=''}={}){const result=assessHumanization([title,description,content].join('\\n'));return {passed:!result.blocked,...result};}
