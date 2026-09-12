import { articles } from '@/lib/articles';
import SubscribePanel from '@/app/components/SubscribePanel';

const basePath = '/Trendforge';
const latestArticles = [...articles].sort((a, b) => b.date.localeCompare(a.date));
const categories = [...new Set(latestArticles.map((article) => article.category))];

export default function Home() {
  const featured = latestArticles[0];
  const secondary = latestArticles.slice(1, 4);

  return <main className="site">
    <header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href="#latest">Latest</a><a href="#topics">Topics</a><a href={`${basePath}/about/`}>About</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header>
    <section className="hero"><div className="eyebrow">Global tech & digital culture</div><h1>What matters.<br/><span>Explained simply.</span></h1><p>TrendForge turns fast-moving technology, AI and digital trends into useful stories you can understand and act on.</p></section>

    <SubscribePanel />

    <section className="grid" id="latest">
      {featured ? <article className="card featured"><div className="tag">{featured.category} · {featured.readTime}</div><h2>{featured.title}</h2><p>{featured.description}</p><a className="read-button" href={`${basePath}/article/${featured.slug}/`}>Read the story <span>→</span></a></article> : <article className="card featured"><div className="tag">Featured</div><h2>The internet changes every day. You don’t have to keep up with all of it.</h2><p>We research the signal, cut through the noise and explain what a trend means for you.</p></article>}
      <div className="side">{secondary.length > 0 ? secondary.map((article) => <article className="card" key={article.slug}><div className="tag">{article.category} · {article.readTime}</div><h3>{article.title}</h3><p>{article.description}</p><a className="read-button" href={`${basePath}/article/${article.slug}/`}>Read <span>→</span></a></article>) : <><article className="card"><div className="tag">AI</div><h3>AI is moving fast. Here’s what actually matters.</h3><p>Clear explanations, useful tools and the changes worth paying attention to — without the noise.</p></article><article className="card"><div className="tag">Technology</div><h3>The tech changes you can actually use</h3><p>Practical guides for smarter digital work, better tools and everyday problems.</p></article></>}</div>
    </section>

    <section className="promise" id="topics"><div className="eyebrow">Explore topics</div><h2>Choose your signal.</h2><p>Browse focused sections instead of scrolling through everything.</p><div className="topic-links">{categories.map((category) => <a className="topic-link" key={category} href={`${basePath}/category/${category.toLowerCase().replace(/\s+/g, '-')}/`}>{category}<span>→</span></a>)}</div></section>
    <footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/about/`}>About</a> · <a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/subscribe/`}>Subscribe</a></span></footer>
  </main>
}
