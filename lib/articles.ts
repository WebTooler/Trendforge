export type Article = { slug:string; title:string; description:string; category:string; date:string; readTime:string; content:string[] };

export const articles: Article[] = [
 {slug:'what-is-ai-agent',title:'What Is an AI Agent? A Simple Guide for Everyone',description:'AI agents are moving from demos into everyday software. Here is what they actually do, how they differ from chatbots, and where they are useful.',category:'AI',date:'2026-09-12',readTime:'5 min read',content:[
 'AI agents are software systems that can take a goal, decide which steps are needed, use tools, and complete parts of a task with limited human input.',
 'A normal chatbot mainly responds to a prompt. An agent can work through a sequence: understand the goal, gather information, choose an action, check the result, and continue when necessary.',
 'The practical difference matters. Instead of asking an AI to write a list of tasks, you could give an agent a goal such as preparing a research brief. The agent could collect sources, organize findings and produce a draft for review.',
 'Agents are not magic. They can make incorrect assumptions, use unreliable information or take an unwanted action. Good systems therefore include source checks, permissions, clear limits and a human approval step for important decisions.',
 'For everyday users, the useful question is not whether something is an agent. Ask what work it can reliably complete, what information it needs, and where you remain in control.' ]}
];

export function getArticle(slug:string){ return articles.find(a=>a.slug===slug); }
