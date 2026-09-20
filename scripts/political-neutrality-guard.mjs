const POLITICAL_CONTEXT=/\b(?:president|prime minister|minister|senator|congress|parliament|government|election|electoral|candidate|campaign|party|politician|political|ballot|vote|voting|legislation|bill|regulation|regulator|policy|democrat|republican|labour|conservative)\b/i;

const DIRECT_PERSUASION=[
  /\b(?:vote|voting)\s+(?:for|against)\s+(?:him|her|them|this|that|the)\b/i,
  /\b(?:you should|you must|you need to|you ought to|voters should|voters must|voters need to|voters ought to)\s+(?:vote|support|oppose|elect|reject)\b/i,
  /\b(?:support|oppose|endorse|reject|elect)\s+(?:this|that|the)\s+(?:candidate|party|politician|bill|measure|policy)\b/i,
  /\b(?:best|worst|better|worse|strongest|weakest)\s+(?:candidate|party|politician|choice)\b/i,
  /\b(?:who|which)\s+(?:should|must|ought to)\s+(?:you|voters)\s+(?:vote|elect|support)\b/i
];

const ELECTABILITY_OR_OUTCOME=[
  /\b(?:will|is likely to|is unlikely to|would)\s+(?:win|lose|be elected|be reelected|win the election|take office)\b/i,
  /\b(?:favou?red|front[- ]runner|likely winner|sure winner)\b/i,
  /\b(?:electability|electable)\b/i
];

const RANKING_SCORE=[
  /\b(?:rank|ranking|rated|rating|score|scored)\s+(?:the )?(?:candidates|parties|politicians|choices)\b/i,
  /\b(?:top|number one|#1|best|worst)\s+(?:candidate|party|politician|political choice)\b/i,
  /\b(?:candidate|party|politician)\s+[A-Z0-9][^.!?]{0,60}\b(?:is|was)\s+(?:the\s+)?(?:best|worst|better|worse)\s+(?:choice|option|candidate)\b/i
];

export function assessPoliticalNeutrality(text=''){
  const value=String(text);
  if(!POLITICAL_CONTEXT.test(value)) return {political:false,blocked:false,reasons:[]};
  const reasons=[];
  if(DIRECT_PERSUASION.some(r=>r.test(value))) reasons.push('direct political persuasion');
  if(ELECTABILITY_OR_OUTCOME.some(r=>r.test(value))) reasons.push('electoral outcome/electability assertion');
  if(RANKING_SCORE.some(r=>r.test(value))) reasons.push('political ranking or score');
  return {political:true,blocked:reasons.length>0,reasons};
}

export function validatePoliticalNeutrality({title='',description='',content=''}={}){
  const text=[title,description,content].join('\n');
  const result=assessPoliticalNeutrality(text);
  return {passed:!result.blocked, ...result};
}
