import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { articles, getArticle } from '@/lib/articles';

const siteUrl = 'https://webtooler.github.io/Trendforge';
const basePath = '/Trendforge';
type ArticleParams = Promise<{ slug: string }>;

export function generateStaticParams(){ return articles.map(a=>({slug:a.slug})); }

export async function generateMetadata({params}:{params:ArticleParams}): Promise<Metadata> {
 const { slug } = await params;
 const article=getArticle(slug);
 if(!article) return {};
 const url=`${siteUrl}/article/${article.slug}/`;
 return { title: article.title, description: article.description, alternates: { canonical: url }, openGraph: { type:'article', title:article.title, description:article.description, url, siteName:'TrendForge', publishedTime:article.date, section:article.category }, twitter: { card:'summary', title:article.title, description:article.description } };
}

function ArticleBlock({block,index}:{block:string;index:number}){
 if(block.startsWith('## ')) return <h2 key={index}>{block.slice(3)}</h2>;
 if(block.startsWith('- ')) return <p key={index} className="bullet">• {block.slice(2)}</p>;
 return <p key={index}>{block}</p>;
}

export default async function ArticlePage({params}:{params:ArticleParams}){
 const { slug } = await params;
 const article=getArticle(slug); if(!article) notFound();
 const url=`${siteUrl}/article/${article.slug}/`;
 const shareText=encodeURIComponent(article.title);
 const shareUrl=encodeURIComponent(url);
 return <main className="site"><header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header><article className="article"><div className="eyebrow">{article.category} · {article.readTime}</div><h1>{article.title}</h1><p className="lead">{article.description}</p><div className="meta">Published {article.date} · <a href={`${basePath}/category/${article.category.toLowerCase().replace(/\s+/g,'-')}/`}>{article.category}</a></div><div className="article-content">{article.content.map((block,i)=><ArticleBlock key={i} block={block} index={i}/>)}</div>{article.sources.length > 0 && <section className="sources"><h2>Sources</h2>{article.sources.map((source,i)=><a key={i} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</section>}<div className="article-share"><strong>Share this story</strong><div><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noreferrer">LinkedIn ↗</a><a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noreferrer">X ↗</a></div></div></article><footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/about/`}>About</a></span></footer></main>
}
