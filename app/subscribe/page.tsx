'use client';

import { useState } from 'react';

const basePath = '/Trendforge';
const feedUrl = 'https://webtooler.github.io/Trendforge/feed.xml';

export default function SubscribePage() {
  const [copied, setCopied] = useState(false);
  async function copyFeed() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(feedUrl);
      else { const area=document.createElement('textarea'); area.value=feedUrl; area.style.position='fixed'; area.style.opacity='0'; document.body.appendChild(area); area.focus(); area.select(); document.execCommand('copy'); area.remove(); }
      setCopied(true); window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }
  return <main className="site">
    <header className="header"><nav className="nav"><a className="logo" href={`${basePath}/`}>Trend<span>Forge</span></a><div className="links"><a href={`${basePath}/`}>Home</a><a href={`${basePath}/#topics`}>Topics</a><a className="nav-subscribe" href={`${basePath}/subscribe/`}>Subscribe</a></div></nav></header>
    <section className="subscribe-page">
      <div className="eyebrow">TrendForge subscription</div>
      <h1>Get the signal.<br/><span>Skip the noise.</span></h1>
      <p className="subscribe-lead">Follow TrendForge in the reader you already use. RSS is the simple, open way to receive new stories without creating another account.</p>
      <article className="subscribe-option" style={{maxWidth:'720px'}}>
        <div className="option-number">RSS FEED</div>
        <h2>Follow TrendForge with Feedly or another RSS reader</h2>
        <p>Copy the TrendForge feed address below, open your RSS reader, and paste it into its search or follow-source box. You do not need a TrendForge account.</p>
        <button className="notify-button light-button" type="button" onClick={copyFeed}>{copied ? 'RSS address copied ✓' : 'Copy RSS feed address'}</button>
        <a className="plain-feed-link" href={`${basePath}/feed.xml`} target="_blank" rel="noreferrer">Open the TrendForge RSS feed →</a>
      </article>
      <div className="subscribe-steps"><div><strong>1</strong><span>Copy the RSS address</span></div><div><strong>2</strong><span>Open Feedly or your RSS reader</span></div><div><strong>3</strong><span>Paste the address</span></div><div><strong>4</strong><span>Follow TrendForge</span></div></div>
      <div className="subscribe-note"><strong>About RSS</strong><br/>RSS is a standard feed that lets reader apps collect new posts from a website. TrendForge publishes the feed; your chosen RSS reader handles the subscription and updates.</div>
    </section>
    <footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/about/`}>About</a> · <a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/subscribe/`}>Subscribe</a></span></footer>
  </main>;
}
