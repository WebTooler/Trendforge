'use client';

import { useState } from 'react';
import NewsletterSignup from '@/app/components/NewsletterSignup';

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
      <p className="subscribe-lead">Choose email for a simple inbox newsletter, or use RSS with the reader you already trust.</p>
      <NewsletterSignup />
      <article className="subscribe-option" style={{maxWidth:'720px'}}>
        <div className="option-number">RSS FEED</div>
        <h2>Follow TrendForge with Feedly or another RSS reader</h2>
        <p>Copy the TrendForge feed address below, open your RSS reader, and paste it into its search or follow-source box. You do not need a TrendForge account.</p>
        <button className="notify-button light-button" type="button" onClick={copyFeed}>{copied ? 'RSS address copied ✓' : 'Copy RSS feed address'}</button>
        <a className="plain-feed-link" href={`${basePath}/feed.xml`} target="_blank" rel="noreferrer">Open the TrendForge RSS feed →</a>
      </article>
      <div className="subscribe-steps"><div><strong>1</strong><span>Choose email or RSS</span></div><div><strong>2</strong><span>Subscribe or copy the feed</span></div><div><strong>3</strong><span>Confirm with your reader/provider</span></div><div><strong>4</strong><span>Receive new TrendForge stories</span></div></div>
      <div className="subscribe-note"><strong>Privacy by design</strong><br/>TrendForge does not keep a subscriber database. Email signups go directly to the configured newsletter provider; RSS subscriptions stay with your chosen RSS reader.</div>
    </section>
    <footer className="footer"><span>© 2026 TrendForge</span><span><a href={`${basePath}/about/`}>About</a> · <a href={`${basePath}/privacy/`}>Privacy</a> · <a href={`${basePath}/terms/`}>Terms</a> · <a href={`${basePath}/subscribe/`}>Subscribe</a></span></footer>
  </main>;
}
