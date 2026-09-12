'use client';

import { useState } from 'react';

const basePath = '/Trendforge';
const feedUrl = 'https://webtooler.github.io/Trendforge/feed.xml';
const feedlyUrl = `https://feedly.com/i/subscription/feed/${encodeURIComponent(feedUrl)}`;

export default function SubscribePage() {
  const [copied, setCopied] = useState(false);

  async function copyFeed() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <main className="site">
    <header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header>
    <section className="subscribe-page">
      <div className="eyebrow">TrendForge subscription</div>
      <h1>Get the signal.<br/><span>Skip the noise.</span></h1>
      <p className="subscribe-lead">Follow TrendForge for useful AI, technology and digital-life stories. Pick the option that works best for you.</p>

      <div className="subscribe-options">
        <article className="subscribe-option">
          <div className="option-number">01</div>
          <h2>Subscribe with Feedly</h2>
          <p>One tap opens TrendForge in Feedly, where you can follow new articles alongside your other feeds.</p>
          <a className="subscribe-button" href={feedlyUrl} target="_blank" rel="noreferrer">Add to Feedly ↗</a>
        </article>
        <article className="subscribe-option">
          <div className="option-number">02</div>
          <h2>Use any RSS reader</h2>
          <p>Copy the TrendForge feed address and paste it into Feedly, Inoreader or another RSS reader.</p>
          <button className="notify-button light-button" type="button" onClick={copyFeed}>{copied ? 'Feed URL copied ✓' : 'Copy RSS feed URL'}</button>
          <a className="plain-feed-link" href={`${basePath}/feed.xml`} target="_blank" rel="noreferrer">View RSS feed →</a>
        </article>
      </div>

      <div className="subscribe-note"><strong>What about browser notifications?</strong><br/>The notification permission control is ready, but real push delivery needs a push service and subscriber storage. We will connect that as the next subscription upgrade.</div>
    </section>
    <footer className="footer"><span>© 2026 TrendForge</span><span>AI · Technology · Digital Life · How-To</span></footer>
  </main>;
}
