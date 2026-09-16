'use client';

import { useEffect, useRef } from 'react';
import styles from './CommentsWidget.module.css';

type CommentsWidgetProps = { articleSlug: string };

export default function CommentsWidget({ articleSlug }: CommentsWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <section className={styles.widget} aria-labelledby={`comments-heading-${articleSlug}`}>
      <div className="eyebrow">Community</div>
      <h2 className={styles.title} id={`comments-heading-${articleSlug}`}>Comments</h2>
      <p className={styles.copy}>Have a question or a useful perspective? Join the conversation.</p>
      <div ref={containerRef} className={styles.comments} aria-label="Article comments" />
    </section>
  );
}
