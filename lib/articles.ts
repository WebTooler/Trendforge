import fs from 'node:fs';
import path from 'node:path';

export type Article = { slug:string; title:string; description:string; category:string; date:string; readTime:string; content:string[] };

const seedArticles: Article[] = [
 {slug:'what-is-ai-agent',title:'What Is an AI Agent? A Simple Guide for Everyone',description:'AI agents are moving from demos into everyday software. Here is what they actually do, how they differ from chatbots, and where they are useful.',category:'AI',date:'2026-09-12',readTime:'5 min read',content:[
 'AI agents are software systems that can take a goal, decide which steps are needed, use tools, and complete parts of a task with limited human input.',
 'A normal chatbot mainly responds to a prompt. An agent can work through a sequence: understand the goal, gather information, choose an action, check the result, and continue when necessary.',
 'The practical difference matters. Instead of asking an AI to write a list of tasks, you could give an agent a goal such as preparing a research brief. The agent could collect sources, organize findings and produce a draft for review.',
 'Agents are not magic. They can make incorrect assumptions, use unreliable information or take an unwanted action. Good systems therefore include source checks, permissions, clear limits and a human approval step for important decisions.',
 'For everyday users, the useful question is not whether something is an agent. Ask what work it can reliably complete, what information it needs, and where you remain in control.' ]}
];

function readGeneratedArticles(): Article[] {
  const dir = path.join(process.cwd(), 'content', 'articles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.md')).map(name => {
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!match) return null;
    const meta: Record<string,string> = {};
    for (const line of match[1].split('\n')) {
      const m = line.match(/^([A-Za-z]+):\s*"?(.*?)"?$/);
      if (m) meta[m[1]] = m[2].replace(/\\"/g, '"');
    }
    const content = match[2].replace(/\n## Sources[\s\S]*$/, '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    return { slug: meta.slug || name.replace(/\.md$/,''), title: meta.title || '', description: meta.description || '', category: meta.category || 'Technology', date: (meta.publishedAt || '').slice(0,10), readTime: `${Math.max(1, Math.ceil(match[2].split(/\s+/).length / 220))} min read`, content };
  }).filter((a): a is Article => Boolean(a && a.title && a.slug));
}

export const articles: Article[] = [...readGeneratedArticles(), ...seedArticles].filter((article, index, all) => all.findIndex(a => a.slug === article.slug) === index);
export function getArticle(slug:string){ return articles.find(a=>a.slug===slug); }
