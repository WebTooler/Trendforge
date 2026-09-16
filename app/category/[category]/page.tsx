import type { Metadata } from 'next';
import { articles } from '@/lib/articles';
import { categoryMetadata, categorySlug } from '@/lib/seo';
import { TREND_FORGE_CATEGORIES } from '@/lib/categories';

const basePath = '/Trendforge';
type CategoryParams = Promise<{ category: string }>;

export function generateStaticParams(){
  return [...new Set([...TREND_FORGE_CATEGORIES.map(categorySlug), ...articles.map(a => categorySlug(a.category))])]
    .map(category => ({ category }));
}

export async function generateMetadata({params}:{params:CategoryParams}): Promise<Metadata> {
 const { category } = await params;
 return categoryMetadata(category);
}

export default async function CategoryPage({params}:{params:CategoryParams}){
 const { category } = await params;
 const name=category.replaceAll('-',' '); const list=articles.filter(a=>categorySlug(a.category)===category);
 return <main className="site"><header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header><section className="hero"><div className="eyebrow">Topic</div><h1 style={{textTransform:'capitalize'}}>{name}</h1><p>Useful stories and explainers from TrendForge.</p></section><section className="grid" style={{gridTemplateColumns:'1fr'}}>{list.length > 0 ? list.map(a=><article className="card" key={a.slug}><div className="tag">{a.category}</div><h2>{a.title}</h2><p>{a.description}</p><a className="read-button" href={`${basePath}/article/${a.slug}/`}>Read article <span>→</span></a></article>) : <article className="card"><div className="tag">Coming soon</div><h2>More {name} stories are on the way.</h2><p>TrendForge is building this topic section. Check back soon for new stories and explainers.</p><a className="read-button" href={`${basePath}/`}>Back to home <span>→</span></a></article>}</section><footer className="footer">© 2026 TrendForge</footer></main>
}
