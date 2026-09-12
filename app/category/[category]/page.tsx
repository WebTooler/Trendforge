import { articles } from '@/lib/articles';

export function generateStaticParams(){ return [...new Set(articles.map(a=>a.category.toLowerCase().replaceAll(' ','-')))].map(category=>({category})); }

export default function CategoryPage({params}:{params:{category:string}}){
 const name=params.category.replaceAll('-',' '); const list=articles.filter(a=>a.category.toLowerCase().replaceAll(' ','-')===params.category);
 return <main className="site"><header className="header"><nav className="nav"><a className="logo" href="/">Trend<span>Forge</span></a><div className="links"><a href="/">Home</a><a href="/#topics">Topics</a></div></nav></header><section className="hero"><div className="eyebrow">Topic</div><h1 style={{textTransform:'capitalize'}}>{name}</h1><p>Useful stories and explainers from TrendForge.</p></section><section className="grid" style={{gridTemplateColumns:'1fr'}}>{list.map(a=><article className="card" key={a.slug}><div className="tag">{a.category}</div><h2>{a.title}</h2><p>{a.description}</p><a href={`/article/${a.slug}/`}>Read article →</a></article>)}</section><footer className="footer">© 2026 TrendForge</footer></main>
}
