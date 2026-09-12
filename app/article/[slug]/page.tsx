import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { articles, getArticle } from '@/lib/articles';

const siteUrl = 'https://webtooler.github.io/Trendforge';
const basePath = '/Trendforge';

export function generateStaticParams(){ return articles.map(a=>({slug:a.slug})); }

export function generateMetadata({params}:{params:{slug:string}}): Metadata {
 const article=getArticle(params.slug);
 if(!article) return {};
 const url=`${siteUrl}/article/${article.slug}/`;
 return { title: article.title, description: article.description, alternates: { canonical: url }, openGraph: { type:'article', title:article.title, description:article.description, url, siteName:'TrendForge', publishedTime:article.date, section:article.category }, twitter: { card:'summary', title:article.title, description:article.description } };
}

function sanitizeArticleHtml(html:string){
 return html
  .replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|textarea|select|svg|math)[^>]*>/gi,'')
  .replace(/\son[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'')
  .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi,'')
  .replace(/\s(?:href|src)\s*=\s*javascript:[^\s>]+/gi,'');
}

function ArticleBlock({block,index}:{block:string;index:number}){
 if(block.startsWith('## ')) return <h2 key={index}>{block.slice(3)}</h2>;
 if(block.startsWith('- ')) return <p key={index} className="bullet">• {block.slice(2)}</p>;
 if(block.trim().startsWith('<')) return <div key={index} className="article-rich" dangerouslySetInnerHTML={{__html:sanitizeArticleHtml(block)}}/>;
 return <p key={index}>{block}</p>;
}

export default function ArticlePage({params}:{params:{slug:string}}){
 const article=getArticle(params.slug); if(!article) notFound();
 const url=`${siteUrl}/article/${article.slug}/`;
 const jsonLd={ '@context':'https://schema.org', '@type':'Article', headline:article.title, description:article.description, datePublished:article.date, dateModified:article.date, mainEntityOfPage:{'@type':'WebPage','@id':url}, publisher:{'@type':'Organization',name:'TrendForge',url:siteUrl}, articleSection:article.category };
 return <main className="site"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/><header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header><article className="article"><div className="eyebrow">{article.category} · {article.readTime}</div><h1>{article.title}</h1><p className="lead">{article.description}</p><div className="meta">Published {article.date}</div><div className="article-content">{article.content.map((block,i)=><ArticleBlock key={i} block={block} index={i}/>)}</div>{article.sources.length > 0 && <section className="sources"><h2>Sources</h2>{article.sources.map((source,i)=><a key={i} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</section>}</article><footer className="footer"><span>© 2026 TrendForge</span><span>AI · Technology · Digital Life · How-To</span></footer></main>
}
