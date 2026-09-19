/* TrendForge Visual Planner v1: story -> subject -> visual type -> scene -> composition -> style. */

const PERSON_PATTERNS = [
  /\b(?:ceo|chief executive|founder|president|minister|researcher|scientist|spokesperson|executive|analyst)\b/i,
  /\b(?:said|says|called for|urged|announced|warned|argued)\b/i
];
const PRODUCT_TERMS = ['iphone','ipad','macbook','pixel','galaxy','smartphone','phone','laptop','tablet','watch','headset','earbuds','camera','console','device','gpu','cpu','chip','processor','robot','drone','sensor'];
const INFRA_TERMS = ['data center','data-centre','server rack','factory','laboratory','lab','warehouse','power plant','satellite','network infrastructure','semiconductor fab'];
const ABSTRACT_TERMS = ['regulation','policy','legislation','governance','antitrust','trade policy','economic shift','industry shift','societal','oversight','slowdown','slow-down','agreement','ban','tariff','competition'];

function clean(value = '') { return value.replace(/\s+/g, ' ').trim(); }

function namedPerson(title, description) {
  const text = title + '. ' + description;
  const matches = [...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g)].map(m => m[1]).filter(x => !/^(When|What|The|This|AI|US|CEO|Dario Amodei)$/.test(x));
  return matches[0] || '';
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
  const person = namedPerson(title, description);
  const company = companyName(title, description);
  let mode = 'editorial-photography', primarySubject = '', scene = '', supportingElements = [], composition = '';
  const avoid = ['generic office imagery','random tablet or laptop','generic futuristic technology','glowing holograms, floating code, HUDs and neon sci-fi effects','prominent readable text or fake headlines'];
  const personSignal = PERSON_PATTERNS.some(p => p.test(text));
  const product = PRODUCT_TERMS.find(term => lower.includes(term));
  const infrastructure = INFRA_TERMS.find(term => lower.includes(term));
  const abstract = ABSTRACT_TERMS.find(term => lower.includes(term));

  if (personSignal && (person || company || /ceo|chief executive|founder|executive|researcher|spokesperson/i.test(text))) {
    mode = 'documentary-person';
    primarySubject = person ? person + ', the central person named by the story' : (company ? company + ' executive/representative central to the story' : 'the central technology-industry executive or speaker');
    scene = 'A restrained documentary technology-publication photograph of the central person publicly speaking, being interviewed, or addressing an industry audience in a context that directly matches the article.';
    supportingElements = ['softly blurred audience or event environment', company ? company + '-specific event context without invented logos or text' : 'minimal event context'];
    composition = 'Medium or medium-wide horizontal frame; subject slightly off-center; back, side, over-the-shoulder, cropped, silhouette, or natural-distance framing so the face is not clearly identifiable.';
    avoid.push('generic product hero replacing the person','invented facial likeness','random consumer electronics as the main subject');
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
  } else {
    primarySubject = 'the most concrete physical subject, event, organization, or action explicitly described by the story';
    scene = 'A commissioned technology-publication photograph of that concrete subject or event, not a category-level representation.';
    supportingElements = ['only contextual elements that directly explain the story'];
    composition = 'One hero subject with one or two supporting elements, natural editorial lighting and strong negative space.';
  }
  return { version: 1, mode, primarySubject, scene, supportingElements, composition, company: company || null, namedPerson: person || null, category, avoid };
}

function buildImagePrompt({ title, description, category, body = '' }) {
  const brief = buildVisualBrief({ title, description, category, body });
  const storyContext = clean(title + '. ' + description).slice(0, 520);
  const prompt = [
    'Create a premium editorial visual commissioned by a major technology publication, not a generic AI image.',
    'Canvas: exactly 1024x576 pixels, horizontal 16:9 composition.',
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
  return { brief, prompt: prompt.length <= maxPromptChars ? prompt : prompt.slice(0, maxPromptChars) };
}

export { buildVisualBrief, buildImagePrompt };