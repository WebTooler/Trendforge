'use client';

import { useEffect, useState } from 'react';
import { articles } from '@/lib/articles';

const basePath = '/Trendforge';
const latestArticle = [...articles].sort((a, b) => b.date.localeCompare(a.date))[0];

export default function SubscribePanel() {
  const [notificationState, setNotificationState] = useState<'idle' | 'enabled' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }

    if (Notification.permission === 'granted') setNotificationState('enabled');
    if (Notification.permission === 'denied') setNotificationState('denied');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${basePath}/trendforge-sw.js`).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (notificationState !== 'enabled' || !latestArticle) return;

    const latestKey = `trendforge-notified:${latestArticle.slug}`;
    const previous = window.localStorage.getItem('trendforge-latest-notified');
    if (previous && previous !== latestArticle.slug && !window.localStorage.getItem(latestKey)) {
      const notify = () => {
        const options: NotificationOptions = {
          body: latestArticle.title,
          icon: `${basePath}/favicon.ico`,
          tag: 'trendforge-new-story',
          data: { url: `${basePath}/article/${latestArticle.slug}/` },
        };
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'TREND_FORGE_NEW_STORY', options });
        } else {
          new Notification('New on TrendForge', options);
        }
        window.localStorage.setItem(latestKey, '1');
      };
      notify();
    }
    window.localStorage.setItem('trendforge-latest-notified', latestArticle.slug);
  }, [notificationState]);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotificationState('denied');
      return;
    }

    setNotificationState('enabled');
    window.localStorage.setItem('trendforge-latest-notified', latestArticle?.slug || '');

    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification('TrendForge notifications enabled', {
        body: 'You will receive a browser alert when a newer TrendForge story is detected on your next visit.',
        icon: `${basePath}/favicon.ico`,
        tag: 'trendforge-notification-enabled',
        data: { url: `${basePath}/` },
      });
    }
  }

  const notificationLabel =
    notificationState === 'enabled'
      ? 'Notifications enabled ✓'
      : notificationState === 'denied'
        ? 'Notifications blocked'
        : notificationState === 'unsupported'
          ? 'Notifications unavailable'
          : 'Get notified';

  return (
    <section className="subscribe-panel" aria-label="TrendForge subscription options">
      <div className="subscribe-copy">
        <div className="eyebrow">Stay ahead</div>
        <h2>Get the signal.<br /><span>Skip the noise.</span></h2>
        <p>Subscribe to TrendForge and keep up with useful AI, technology and digital-life stories.</p>
      </div>
      <div className="subscribe-actions">
        <a className="subscribe-button" href={`${basePath}/subscribe/`}>
          Subscribe <span>→</span>
        </a>
        <button className="notify-button" type="button" onClick={enableNotifications} disabled={notificationState === 'enabled' || notificationState === 'unsupported'}>
          <span className="bell" aria-hidden="true">♧</span> {notificationLabel}
        </button>
        <small>Browser notifications are connected to TrendForge's notification service worker. New-story alerts are checked when you return to the site.</small>
      </div>
    </section>
  );
}
