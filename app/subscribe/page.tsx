'use client';

import { useState } from 'react';

const basePath = '/Trendforge';
const feedUrl = 'https://webtooler.github.io/Trendforge/feed.xml';
const feedlyUrl = 'https://feedly.com/';

export default function SubscribePage() {
  const [copied, setCopied] = useState(false);

  async function copyFeed() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(feedUrl);
      } else {
        const area = document.createElement('textarea');
        area.value = feedUrl;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.focus();
        area.select();
        document.execCommand('copy');
        area.remove();
      }
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
      <p className="subscribe-lead">Follow TrendForge for useful AI, technology and digital-life stories. Choose the reader you already use.</p>
      <div className="subscribe-options">
        <article className="subscribe-option">
          <div className="option-number">01</div>
          <h2>Add TrendForge to Feedly</h2>
          <p>Open Feedly, choose <strong>Follow Sources</strong>, then search or paste the TrendForge RSS address. Tap Follow when TrendForge appears.</p>
          <a className="subscribe-button" href={feedlyUrl} target="_blank" rel="noreferrer">Open Feedly ↗</a>
          <button className="notify-button light-button" type="button" onClick={copyFeed}>{copied ? 'Feed URL copied ✓' : 'Copy RSS feed URL'}</button>
        </article>
        <article className="subscribe-option">
          <div className="option-number">02</div>
          <h2>Use any RSS reader</h2>
          <p>Copy the public TrendForge feed and paste it into Feedly, Inoreader, NetNewsWire or another RSS reader.</p>
          <button className="notify-button light-button" type="button" onClick={copyFeed}>{copied ? 'Feed URL copied ✓' : 'Copy RSS feed URL'}</button>
          <a className="plain-feed-link" href={`${basePath}/feed.xml`} target="_blank" rel="noreferrer">View RSS feed →</a>
        </article>
      </div>
      <div className="subscribe-steps">
        <div><strong>1</strong><span>Open Feedly</span></div>
        <div><strong>2</strong><span>Choose Follow Sources</span></div>
        <div><strong>3</strong><span>Paste the RSS URL</span></div>
        <div><strong>4</strong><span>Select TrendForge and Follow</span></div>
      </div>
      <div className="subscribe-note"><strong>Browser notifications</strong><br/>Browser permission is not the same as live push delivery. TrendForge will only enable real push alerts after a complete delivery service and subscriber-storage path is implemented.</div>
    </section>
    <footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/about/`}>About</a></span></footer>
  </main>;
}
