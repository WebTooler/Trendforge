import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { articles, getArticle } from '@/lib/articles';

const siteUrl = 'https://webtooler.github.io/Trendforge';

export function generateStaticParams(){ return articles.map(a=>({slug:a.slug})); }

export function generateMetadata({params}:{params:{slug:string}}): Metadata {
 const article=getArticle(params.slug);
 if(!article) return {};
 const url=`${siteUrl}/article/${article.slug}/`;
 return {
  title: article.title,
  description: article.description,
  alternates: { canonical: url },
  openGraph: { type:'article', title:article.title, description:article.description, url, siteName:'TrendForge', publishedTime:article.date, section:article.category },
  twitter: { card:'summary', title:article.title, description:article.description },
 };
}

export default function ArticlePage({params}:{params:{slug:string}}){
 const article=getArticle(params.slug); if(!article) notFound();
 const url=`${siteUrl}/article/${article.slug}/`;
 const jsonLd={
  '@context':'https://schema.org',
  '@type':'Article',
  headline:article.title,
  description:article.description,
  datePublished:article.date,
  dateModified:article.date,
  mainEntityOfPage:{'@type':'WebPage','@id':url},
  publisher:{'@type':'Organization',name:'TrendForge',url:siteUrl},
  articleSection:article.category,
 };
 return <main className="site"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/><header className="header"><nav className="nav"><a className="logo" href="/">Trend<span>Forge</span></a><div className="links"><a href="/">Home</a><a href="/#topics">Topics</a></div></nav></header><article className="article"><div className="eyebrow">{article.category} · {article.readTime}</div><h1>{article.title}</h1><p className="lead">{article.description}</p><div className="meta">Published {article.date}</div>{article.content.map((block,i)=> block.startsWith('## ') ? <h2 key={i}>{block.slice(3)}</h2> : block.startsWith('- ') ? <p key={i} className="bullet">• {block.slice(2)}</p> : <p key={i}>{block}</p>)}{article.sources.length > 0 && <section className="sources"><h2>Sources</h2>{article.sources.map((source,i)=><a key={i} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</section>}</article><footer className="footer">© 2026 TrendForge</footer></main>
}
