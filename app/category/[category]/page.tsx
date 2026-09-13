import type { Metadata } from 'next';
import { articles } from '@/lib/articles';

const siteUrl = 'https://webtooler.github.io/Trendforge';
const basePath = '/Trendforge';
type CategoryParams = Promise<{ category: string }>;

export function generateStaticParams(){ return [...new Set(articles.map(a=>a.category.toLowerCase().replaceAll(' ','-')))].map(category=>({category})); }

export async function generateMetadata({params}:{params:CategoryParams}): Promise<Metadata> {
 const { category } = await params;
 const name=category.replaceAll('-',' ');
 const title=name.replace(/\b\w/g,c=>c.toUpperCase());
 const url=`${siteUrl}/category/${category}/`;
 return { title: `${title} — TrendForge`, description:`Useful ${title.toLowerCase()} stories and explainers from TrendForge.`, alternates:{canonical:url}, openGraph:{type:'website',title:`${title} — TrendForge`,description:`Useful ${title.toLowerCase()} stories and explainers from TrendForge.`,url,siteName:'TrendForge'}};
}

export default async function CategoryPage({params}:{params:CategoryParams}){
 const { category } = await params;
 const name=category.replaceAll('-',' '); const list=articles.filter(a=>a.category.toLowerCase().replaceAll(' ','-')===category);
 return <main className="site"><header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a></div></nav></header><section className="hero"><div className="eyebrow">Topic</div><h1 style={{textTransform:'capitalize'}}>{name}</h1><p>Useful stories and explainers from TrendForge.</p></section><section className="grid" style={{gridTemplateColumns:'1fr'}}>{list.map(a=><article className="card" key={a.slug}><div className="tag">{a.category}</div><h2>{a.title}</h2><p>{a.description}</p><a className="read-button" href={`${basePath}/article/${a.slug}/`}>Read article <span>→</span></a></article>)}</section><footer className="footer">© 2026 TrendForge</footer></main>
}
