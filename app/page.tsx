const stories = [
  {tag:'AI', title:'AI is moving fast. Here’s what actually matters.', text:'Clear explanations, useful tools and the changes worth paying attention to — without the noise.'},
  {tag:'Technology', title:'The tech changes you can actually use', text:'Practical guides for smarter digital work, better tools and everyday problems.'},
  {tag:'Digital Life', title:'Make your digital life simpler', text:'Simple, actionable ideas for apps, privacy, productivity and the modern web.'},
];

export default function Home() {
  return <main className="site">
    <header className="header"><nav className="nav"><div className="logo">Trend<span>Forge</span></div><div className="links"><a href="#latest">Latest</a><a href="#topics">Topics</a><a href="#about">About</a></div></nav></header>
    <section className="hero"><div className="eyebrow">Global tech & digital culture</div><h1>What matters.<br/>Explained simply.</h1><p>TrendForge turns fast-moving technology, AI and digital trends into useful stories you can understand and act on.</p></section>
    <section className="grid" id="latest"><article className="card featured"><div className="tag">Featured</div><h2>The internet changes every day. You don’t have to keep up with all of it.</h2><p>We research the signal, cut through the noise and explain what a trend means for you.</p></article>
      <div className="side">{stories.map((s)=><article className="card" key={s.title}><div className="tag">{s.tag}</div><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
    </section>
    <section className="hero" id="topics"><div className="eyebrow">Our promise</div><h2 style={{fontSize:'clamp(32px,5vw,54px)',letterSpacing:'-2px',maxWidth:750}}>Original. Useful. Worth your time.</h2><p>TrendForge is being built as an editorial-first platform, with automation handling the repetitive work and quality checks protecting the reader experience.</p></section>
    <footer className="footer" id="about">© 2026 TrendForge · AI · Technology · Digital Life · How-To</footer>
  </main>
}
