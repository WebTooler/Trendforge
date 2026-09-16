'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

type FeedbackWidgetProps = { articleSlug: string };
type Rating = 'positive' | 'negative';

const reasons = ['More detail', 'Better explanation', 'More sources', 'Something was unclear', 'Other'];
const FEEDBACK_KEY = 'trendforge_feedback_submitted';

export default function FeedbackWidget({ articleSlug }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submitFeedback() {
    if (!rating || submitted) return;

    trackEvent('article_feedback', {
      article: articleSlug,
      rating,
      reason: reason || 'none',
      commentLength: Math.min(comment.trim().length, 1000),
    });

    try {
      const existing = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]') as string[];
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify([...new Set([...existing, articleSlug])]));
    } catch {
      // Feedback must never interrupt reading.
    }

    setSubmitted(true);
  }

  return (
    <section className="feedback-widget" aria-labelledby="feedback-heading">
      {!submitted ? <>
        <div className="eyebrow">Reader feedback</div>
        <h2 id="feedback-heading">Was this article helpful?</h2>
        <p>Your response is collected as anonymous feedback for observation only. It does not change this article or TrendForge's publishing rules.</p>
        <div className="feedback-rating" role="group" aria-label="Article helpfulness">
          <button type="button" className={rating === 'positive' ? 'selected' : ''} aria-pressed={rating === 'positive'} onClick={() => setRating('positive')}>👍 Yes</button>
          <button type="button" className={rating === 'negative' ? 'selected' : ''} aria-pressed={rating === 'negative'} onClick={() => setRating('negative')}>👎 No</button>
        </div>
        {rating === 'negative' && <div className="feedback-details">
          <label htmlFor={`feedback-reason-${articleSlug}`}>What could be better?</label>
          <select id={`feedback-reason-${articleSlug}`} value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="">Choose an option</option>
            {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor={`feedback-comment-${articleSlug}`}>Anything else? <span>(optional)</span></label>
          <textarea id={`feedback-comment-${articleSlug}`} value={comment} onChange={(event) => setComment(event.target.value.slice(0, 1000))} placeholder="Tell us more..." rows={3} />
        </div>}
        <button className="feedback-submit" type="button" disabled={!rating} onClick={submitFeedback}>Submit feedback</button>
        <small>Anonymous · No account required · Observation only</small>
      </> : <div className="feedback-thanks" role="status">
        <strong>Thanks for the feedback. ✓</strong>
        <span>Your response has been recorded for observation.</span>
      </div>}
    </section>
  );
}
