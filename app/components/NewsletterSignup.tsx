'use client';

const formAction = process.env.NEXT_PUBLIC_NEWSLETTER_FORM_ACTION?.trim() ?? '';

export default function NewsletterSignup() {
  if (!formAction) {
    return (
      <section className="newsletter-card" aria-labelledby="newsletter-title">
        <div className="option-number">EMAIL NEWSLETTER</div>
        <h2 id="newsletter-title">Get the next useful story in your inbox.</h2>
        <p>
          The newsletter signup is ready, but the delivery provider has not been connected yet. TrendForge stays fully static until you choose a provider.
        </p>
        <div className="newsletter-status">Provider connection pending · RSS is available now.</div>
        <a className="plain-feed-link" href="/Trendforge/feed.xml">Use the TrendForge RSS feed →</a>
      </section>
    );
  }

  return (
    <section className="newsletter-card" aria-labelledby="newsletter-title">
      <div className="option-number">EMAIL NEWSLETTER</div>
      <h2 id="newsletter-title">Get the next useful story in your inbox.</h2>
      <p>One email when new TrendForge stories are published. No account on TrendForge is required.</p>
      <form className="newsletter-form" action={formAction} method="post">
        <label htmlFor="newsletter-email">Email address</label>
        <div className="newsletter-form-row">
          <input id="newsletter-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <input type="hidden" name="embed" value="1" />
          <input type="hidden" name="tag" value="trendforge-website" />
          <button type="submit">Subscribe</button>
        </div>
        <small>Your email is sent directly to the configured newsletter provider. TrendForge does not store subscriber addresses.</small>
      </form>
    </section>
  );
}
