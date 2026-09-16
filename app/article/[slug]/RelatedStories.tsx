import type { RelatedArticle } from '@/lib/internal-links-v2';
import styles from './RelatedStories.module.css';

const basePath = '/Trendforge';

export default function RelatedStories({ articles }: { articles: RelatedArticle[] }) {
  return (
    <section className={styles.section} aria-labelledby="related-stories-heading">
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>Keep exploring</div>
          <h2 id="related-stories-heading">Related stories</h2>
        </div>
        <p>More TrendForge stories connected to this topic.</p>
      </div>
      <div className={styles.grid}>
        {articles.map((article) => (
          <a className={styles.card} key={article.slug} href={`${basePath}/article/${article.slug}/`}>
            <span className={styles.category}>{article.category}</span>
            <span className={styles.title}>{article.title}</span>
            <span className={styles.description}>{article.description}</span>
            <span className={styles.read}>Read story →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
