'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CommentsWidget.module.css';

type CommentsWidgetProps = { articleSlug: string };

export default function CommentsWidget({ articleSlug }: CommentsWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.loaded === 'true') return;

    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('repo', 'WebTooler/Trendforge');
    script.setAttribute('issue-term', 'pathname');
    script.setAttribute('label', 'comments');
    script.setAttribute('theme', 'github-light');

    container.dataset.loaded = 'true';
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
      delete container.dataset.loaded;
    };
  }, [articleSlug]);

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;

    const pageUrl = `${window.location.origin}${window.location.pathname}`;
    const title = `Comment: ${document.title.replace(/\s*[|·-]\s*TrendForge.*$/i, '').trim()}`;
    const body = `${text}\n\n---\nArticle: ${pageUrl}`;
    const issueUrl = `https://github.com/WebTooler/Trendforge/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(issueUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={styles.widget} aria-labelledby={`comments-heading-${articleSlug}`}>
      <div className="eyebrow">Community</div>
      <h2 className={styles.title} id={`comments-heading-${articleSlug}`}>Comments</h2>
      <p className={styles.copy}>Have a question or a useful perspective? Join the conversation.</p>

      <div className={styles.composer}>
        <label htmlFor={`comment-${articleSlug}`} className={styles.label}>Write a comment</label>
        <textarea
          id={`comment-${articleSlug}`}
          className={styles.textarea}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share your thoughts..."
          rows={4}
          maxLength={2000}
        />
        <button type="button" className={styles.submit} onClick={submitComment} disabled={!comment.trim()}>
          Continue to GitHub
        </button>
      </div>

      <div
        ref={containerRef}
        className={styles.comments}
        aria-label="Article comments"
        data-comments-provider="utterances"
      />
    </section>
  );
}
