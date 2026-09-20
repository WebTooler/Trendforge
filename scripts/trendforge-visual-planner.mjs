/* TrendForge Visual Planner v2: story -> subject -> visual type -> scene -> composition -> style. */

const PERSON_PATTERNS = [
  /\b(?:ceo|chief executive|founder|president|minister|researcher|scientist|spokesperson|executive|analyst)\b/i,
  /\b(?:said|says|called for|urged|announced|warned|argued)\b/i
];
const PRODUCT_TERMS = ['iphone','ipad','macbook','pixel','galaxy','smartphone','phone','laptop','tablet','watch','headset','earbuds','camera','console','device','gpu','cpu','chip','processor','robot','drone','sensor'];
const INFRA_TERMS = ['data center','data-centre','server rack','factory','laboratory','lab','warehouse','power plant','satellite','network infrastructure','semiconductor fab'];
const ABSTRACT_TERMS = ['regulation','policy','legislation','governance','antitrust','trade policy','economic shift','industry shift','societal','oversight','slowdown','slow-down','agreement','ban','tariff','competition'];
const STORY_STOPWORDS = new Set(['the','a','an','and','or','of','to','for','in','on','with','from','by','is','are','was','were','what','why','how','says','said','now','new','after','before','about']);
function storyAnchors(title='', description='') { return [...new Set(clean(title+' '+description).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!STORY_STOPWORDS.has(w)))].slice(0,8); }

function clean(value = '') { return value.replace(/\s+/g, ' ').trim(); }

function namedPerson(title, description, body = '') {
  const text = clean(title + '. ' + description + ' ' + body.slice(0, 8000));
  const blocked = new Set(['When','What','The','This','Moment','Why','Current','Industry','Regulatory','Economic','Open','Sources','AI','US','CEO','CTO','Anthropic','OpenAI','Google','Microsoft','Apple','Meta','Amazon','Nvidia','Tesla','Samsung','Disney','Android','Crypto','Bitcoin','Digital Life','Move Passwords','Account Help','Sends Crypto Rule']);
  const orgWords = /\b(?:Anthropic|OpenAI|Google|Microsoft|Apple|Meta|Amazon|Nvidia|Tesla|Samsung|Disney|JPMorgan|CFTC|Comp AI)\b/i;
  const badPhrase = /\b(?:appoints|appointed|first-ever|first|raises|sends|moves|move|update|updates|set up|setup|what it means|valuation|rule|draft|passwords|apps|account|digital life)\b/i;
  const isValid = value => {
    const name = clean(value);
    if (!name || blocked.has(name) || orgWords.test(name) || badPhrase.test(name)) return false;
    const parts = name.split(/\s+/);
    return parts.length >= 2 && parts.length <= 3 && parts.every(part => /^[A-Z][a-z'’-]+$/.test(part));
  };
  const rolePatterns = [
    /\b([A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)\s*,\s+(?:the\s+)?(?:chief executive|CEO|CTO|founder|president|minister|researcher|scientist|spokesperson|executive|analyst)\b/,
    /\b([A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)\s+(?:publicly\s+)?(?:urged|called|warned|announced|argued|said|says)\b/,
    /\b(?:according to|interview with|interviewed by|led by|from|by)\s+([A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)\b/
  ];
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match?.[1] && isValid(match[1])) return clean(match[1]);
  }
  return '';
}
function companyName(title, description) {
  const known = ['Anthropic','OpenAI','Google','Microsoft','Apple','Meta','Amazon','Nvidia','Tesla','Samsung','xAI','OpenRouter'];
  const text = (title + ' ' + description).toLowerCase();
  return known.find(name => text.includes(name.toLowerCase())) || '';
}

function buildVisualBrief({ title = '', description = '', category = '', body = '' } = {}) {
  title = clean(title); description = clean(description); category = clean(category);
  const text = title + ' ' + description + ' ' + body.slice(0, 5000);
  const lower = text.toLowerCase();
  const person = namedPerson(title, description, body);
  const company = companyName(title, description);
  let mode = 'editorial-photography', primarySubject = '', scene = '', supportingElements = [], composition = '';
  const avoid = ['generic office imagery','random tablet or laptop','generic futuristic technology','glowing holograms, floating code, HUDs and neon sci-fi effects','prominent readable text or fake headlines'];
  const personSignal = PERSON_PATTERNS.some(p => p.test(text));
  const explicitPersonContext = /\b(?:ceo|chief executive|cto|founder|president|minister|researcher|scientist|spokesperson|executive|analyst)\b/i.test(text) && Boolean(person);
  const howTo = /\b(?:how to|steps|setup|set up|guide|tutorial|safely|keep them current|between managers)\b/i.test(lower);
  const personFirst = explicitPersonContext && !howTo;
  const storyText = title + ' ' + description;
  const product = PRODUCT_TERMS.find(term => new RegExp('\\b' + term + '\\b', 'i').test(storyText));
  const infrastructure = INFRA_TERMS.find(term => new RegExp('\\b' + term + '\\b', 'i').test(lower));
  const abstract = ABSTRACT_TERMS.find(term => lower.includes(term));
  const anchors = storyAnchors(title, description);

  if (personFirst) {
    mode = 'documentary-person';
    primarySubject = person ? person + ', the central person named by the story' : (company ? company + ' executive/representative central to the story' : 'the central technology-industry executive or speaker');
    scene = 'A restrained documentary technology-publication photograph of the central person publicly speaking, being interviewed, or addressing an industry audience in a context that directly matches the article.';
    supportingElements = ['softly blurred audience or event environment', company ? company + '-specific event context without invented logos or text' : 'minimal event context'];
    composition = 'Medium or medium-wide horizontal frame; subject slightly off-center; back, side, over-the-shoulder, cropped, silhouette, or natural-distance framing so the face is not clearly identifiable.';
    avoid.push('generic product hero replacing the person','invented facial likeness','random consumer electronics as the main subject');
  } else if (infrastructure) {
    mode = 'environment-infrastructure';
    primarySubject = 'the specific ' + infrastructure + ' or physical infrastructure central to the story';
    scene = 'A realistic editorial photograph of the named infrastructure or environment, captured as the concrete subject rather than as generic technology scenery.';
    supportingElements = ['one contextual scale or human element only when useful'];
    composition = 'Architectural or documentary framing with one dominant physical structure and clear visual hierarchy.';
  } else if (product) {
    mode = 'editorial-product';
    primarySubject = 'the specific ' + product + ' or physical technology named by the story';
    scene = 'A premium commissioned product/editorial photograph showing the actual named physical product or hardware as the unmistakable hero subject.';
    supportingElements = ['one restrained real-world context element only if it explains the story'];
    composition = 'Single hero object, clean 16:9 framing, realistic materials and proportions, controlled depth of field, generous negative space.';
    avoid.push('generic replacement device','invented ports, camera layouts or controls');
  } else if (infrastructure) {
    mode = 'environment-infrastructure';
    primarySubject = 'the specific ' + infrastructure + ' or physical infrastructure central to the story';
    scene = 'A realistic editorial photograph of the named infrastructure or environment, captured as the concrete subject rather than as generic technology scenery.';
    supportingElements = ['one contextual scale or human element only when useful'];
    composition = 'Architectural or documentary framing with one dominant physical structure and clear visual hierarchy.';
  } else if (abstract) {
    mode = 'conceptual-editorial';
    primarySubject = (abstract === 'slowdown' || abstract === 'slow-down') ? 'the concrete idea of slowing or pausing AI development' : 'the specific policy, governance, market, or industry action described by the story';
    scene = 'A sophisticated editorial photo-illustration or carefully staged metaphor that makes the specific central idea immediately understandable without relying on generic AI symbols.';
    supportingElements = ['at most one concrete metaphorical object or environmental cue tied directly to the story'];
    composition = 'One strong metaphor or visual action, restrained editorial treatment, clear hierarchy, no collage of unrelated symbols.';
    avoid.push('generic AI brain','random server rack','generic circuit board','stock-looking technology montage');
  } else if (howTo) {
    mode = 'editorial-product';
    primarySubject = product ? 'the specific ' + product + ' and the concrete task described by the guide' : 'the concrete device, interface, or action required by the guide';
    scene = 'A clean commissioned technology-publication photograph showing the real-world object or device involved in the procedure, with the action implied through physical context rather than fake interface text.';
    supportingElements = ['one restrained contextual object directly involved in the task'];
    composition = 'Single hero object or close physical detail, clean 16:9 framing, realistic materials, controlled depth of field, generous negative space.';
    avoid.push('fake app screens','invented interface labels');
  } else {
    primarySubject = 'the most concrete physical subject, event, organization, or action explicitly described by the story, centered on ' + anchors.slice(0,4).join(', ');
    scene = 'A commissioned technology-publication photograph of that concrete subject or event, not a category-level representation.';
    supportingElements = ['only contextual elements that directly explain the story'];
    composition = 'One hero subject with one or two supporting elements, natural editorial lighting and strong negative space.';
  }
  return { version: 2, mode, primarySubject, scene, supportingElements, composition, company: company || null, namedPerson: person || null, category, storyAnchors: anchors, avoid };
}

function assessVisualRelevance({ title = '', description = '', brief = null } = {}) {
  const anchors = storyAnchors(title, description);
  const haystack = clean([brief?.primarySubject, brief?.scene, ...(brief?.supportingElements || [])].join(' ')).toLowerCase();
  const matchedAnchors = anchors.filter(anchor => haystack.includes(anchor));
  const entityAnchors = [brief?.company, brief?.namedPerson].filter(Boolean).map(x => String(x).toLowerCase());
  const entityMatches = entityAnchors.filter(x => haystack.includes(x));
  const passed = anchors.length === 0 ? true : matchedAnchors.length >= Math.min(2, anchors.length);
  return { passed, anchors, matchedAnchors, entityMatches, score: anchors.length ? matchedAnchors.length / anchors.length : 1 };
}

function buildImagePrompt({ title, description, category, body = '' }) {
  const brief = buildVisualBrief({ title, description, category, body });
  const storyContext = clean(title + '. ' + description).slice(0, 520);
  const relevance = assessVisualRelevance({ title, description, brief });
  if (!relevance.passed) throw new Error('visual relevance planner could not bind the prompt to the story anchors');
  const prompt = [
    'Create a premium editorial visual commissioned by a major technology publication, not a generic AI image.',
    'Canvas: exactly 1024x576 pixels, horizontal 16:9 composition.',
    'STORY ANCHORS: ' + brief.storyAnchors.join(', ') + '.',
    'VISUAL MODE: ' + brief.mode + '.',
    'PRIMARY VISUAL SUBJECT: ' + brief.primarySubject + '.',
    'SCENE: ' + brief.scene,
    'SUPPORTING ELEMENTS: ' + brief.supportingElements.slice(0, 2).join('; ') + '.',
    'COMPOSITION: ' + brief.composition,
    'STORY RULE: represent the actual central story/event/subject/action, not merely the article category.',
    'STYLE MUST NEVER OVERRIDE STORY. Choose the concrete visual subject first, then apply editorial treatment.',
    'Minimalism: one clear hero subject or visual idea, with no more than two supporting elements.',
    'No crowded scenes, decorative technology, holograms, floating code, HUDs, neon sci-fi interfaces, fake dashboards, or unrelated props.',
    'For person-specific stories, do not show a clearly identifiable face. Use back, side, over-the-shoulder, cropped, silhouette, hands, or natural-distance framing.',
    'For real products, preserve known physical design and do not replace a named product with a generic futuristic device.',
    'No prominent readable text, captions, labels, watermarks, fake headlines, or intentional typography. Background text may be naturally blurred or unreadable.',
    'Do not force a fixed brand palette. Use restrained colors appropriate to the real subject.',
    'AVOID: ' + brief.avoid.slice(0, 6).join('; ') + '.',
    'ARTICLE STORY (semantic context only; never render as text): ' + storyContext
  ].join('\n');

  // Keep the shared planner prompt safely below strict model prompt limits such as FLUX.1 Schnell.
  const maxPromptChars = 1900;
  return { brief, prompt: prompt.length <= maxPromptChars ? prompt : prompt.slice(0, maxPromptChars), relevance };
}

export { buildVisualBrief, buildImagePrompt, storyAnchors, assessVisualRelevance };