'use client';

import styles from './NewsletterSignup.module.css';

const formAction = process.env.NEXT_PUBLIC_NEWSLETTER_FORM_ACTION?.trim() ?? '';

export default function NewsletterSignup() {
  if (!formAction) {
    return (
      <section className={styles.card} aria-labelledby="newsletter-title">
        <div className="option-number">EMAIL NEWSLETTER</div>
        <h2 id="newsletter-title" className={styles.title}>Get the next useful story in your inbox.</h2>
        <p className={styles.copy}>The newsletter signup is ready, but the delivery provider has not been connected yet. TrendForge stays fully static until you choose a provider.</p>
        <div className={styles.status}>Provider connection pending · RSS is available now.</div>
        <a className={styles.link} href="/Trendforge/feed.xml">Use the TrendForge RSS feed →</a>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="newsletter-title">
      <div className="option-number">EMAIL NEWSLETTER</div>
      <h2 id="newsletter-title" className={styles.title}>Get the next useful story in your inbox.</h2>
      <p className={styles.copy}>One email when new TrendForge stories are published. No account on TrendForge is required.</p>
      <form className={styles.form} action={formAction} method="post">
        <label className={styles.label} htmlFor="newsletter-email">Email address</label>
        <div className={styles.row}>
          <input className={styles.input} id="newsletter-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <input type="hidden" name="embed" value="1" />
          <input type="hidden" name="tag" value="trendforge-website" />
          <button className={styles.button} type="submit">Subscribe</button>
        </div>
        <small className={styles.note}>Your email is sent directly to the configured newsletter provider. TrendForge does not store subscriber addresses.</small>
      </form>
    </section>
  );
}
