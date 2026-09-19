import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { articles, getArticle } from '@/lib/articles';
import { getRelatedArticles } from '@/lib/internal-links-v2';
import { articleJsonLd, articleMetadata, breadcrumbJsonLd, safeJsonLd, siteName, siteUrl } from '@/lib/seo';
import FeedbackWidget from '@/app/components/FeedbackWidget';
import CommentsWidget from '@/app/components/CommentsWidget';
import RelatedStories from './RelatedStories';

const basePath = '/Trendforge';
type ArticleParams = Promise<{ slug: string }>;

export function generateStaticParams(){ return articles.map(a=>({slug:a.slug})); }

export async function generateMetadata({params}:{params:ArticleParams}): Promise<Metadata> {
 const { slug } = await params;
 const article=getArticle(slug);
 if(!article) return {};
 return articleMetadata(article);
}

function formatPublishedAt(value?: string, fallback?: string) {
 const source = value || fallback;
 if (!source) return '';
 const date = new Date(source);
 if (Number.isNaN(date.getTime())) return source;
 return new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
 }).format(date) + ' IST';
}

function articleMarkdown(content:string[]){
 const blocks=content.map(block=>block.trim()).filter(Boolean);
 let markdown='';
 const listKind=(value:string)=>{
  if(/^[-*+]\\s/.test(value)) return 'unordered';
  if(/^\\d+[.)]\\s/.test(value)) return 'ordered';
  if(/^\\|/.test(value)) return 'table';
  return '';
 };
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i];
  const previous=blocks[i-1];
  const kind=listKind(block);
  const previousKind=previous ? listKind(previous) : '';
  const continuation=kind!=='' && kind===previousKind;
  markdown += (i===0 ? '' : continuation ? '\\n' : '\\n\\n') + block;
 }
 return markdown;
}
const markdownComponents={
 h1:({children}:{children:ReactNode})=><h2>{children}</h2>,
};
export default async function ArticlePage({params}:{params:ArticleParams}){
 const { slug } = await params;
 const article=getArticle(slug); if(!article) notFound();
 const related=getRelatedArticles(article, articles, 3);
 const url=`${siteUrl}/article/${article.slug}/`;
 const shareText=encodeURIComponent(article.title);
 const shareUrl=encodeURIComponent(url);
 const jsonLd=safeJsonLd(articleJsonLd(article));
 const breadcrumbs=safeJsonLd(breadcrumbJsonLd([{name:'Home',path:'/'},{name:article.category,path:`/category/${article.category.toLowerCase().replace(/\s+/g,'-')}/`},{name:article.title,path:`/article/${article.slug}/`} ]));
 const publishedLabel = formatPublishedAt(article.publishedAt, article.date);
 return <main className="site"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumbs}}/><header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>{siteName}</a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header><article className="article"><div className="eyebrow">{article.category} · {article.readTime}</div><h1>{article.title}</h1><p className="lead">{article.description}</p><div className="meta"><span>By <strong>{article.author}</strong></span>{publishedLabel && <><span aria-hidden="true"> · </span><time dateTime={article.publishedAt || article.date}>Published {publishedLabel}</time></>}<span aria-hidden="true"> · </span><a href={`${basePath}/category/${article.category.toLowerCase().replace(/\s+/g,'-')}/`}>{article.category}</a></div><figure className="article-hero"><img src={article.image} alt={article.imageAlt} width={1200} height={630} loading="eager"/><figcaption>{article.imageSource} · {article.imageLicense}</figcaption></figure><div className="article-content"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} skipHtml components={markdownComponents}>{articleMarkdown(article.content)}</Markdown></div>{article.sources.length > 0 && <section className="sources"><h2>Sources</h2>{article.sources.map((source,i)=><a key={i} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</section>}{related.length > 0 && <RelatedStories articles={related}/>}<CommentsWidget articleSlug={article.slug}/><FeedbackWidget articleSlug={article.slug}/><div className="article-share"><strong>Share this story</strong><div><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noreferrer">LinkedIn ↗</a><a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noreferrer">X ↗</a></div></div></article><footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/about/`}>About</a> · <a href={`${basePath}/monetization/`}>Monetization</a></span></footer></main>
}
