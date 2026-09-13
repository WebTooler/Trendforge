import { monetizationDisclosure } from '@/lib/monetization';

const basePath = '/Trendforge';

export const metadata = {
  title: 'Monetization Disclosure | TrendForge',
  description: 'How TrendForge may use advertising, sponsorships, and affiliate links.',
};

export default function MonetizationPage() {
  return (
    <main className="site">
      <header className="header"><nav className="nav" aria-label="Primary navigation"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/about/`}>About</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header>
      <article className="article">
        <div className="eyebrow">Transparency</div>
        <h1>Monetization disclosure</h1>
        <p className="lead">{monetizationDisclosure()}</p>
        <div className="article-content">
          <h2>Advertising</h2>
          <p>TrendForge is designed to support privacy-conscious advertising through a configurable advertising layer. Ads are disabled until an approved advertising account is connected.</p>
          <h2>Affiliate links</h2>
          <p>If TrendForge later uses affiliate links, they will be identified where appropriate. A commission does not change the price you pay unless the partner states otherwise.</p>
          <h2>Sponsorships</h2>
          <p>Sponsored relationships will be disclosed clearly. Sponsored material will not be presented as independent editorial reporting.</p>
          <h2>Editorial independence</h2>
          <p>Commercial relationships do not buy favorable coverage, rankings, or conclusions. Editorial decisions remain separate from monetization decisions.</p>
        </div>
      </article>
      <footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/about/`}>About</a></span></footer>
    </main>
  );
}
