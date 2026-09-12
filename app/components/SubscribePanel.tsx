'use client';

import { useEffect, useState } from 'react';

const basePath = '/Trendforge';

export default function SubscribePanel() {
  const [notificationState, setNotificationState] = useState<'idle' | 'enabled' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') setNotificationState('enabled');
    if (Notification.permission === 'denied') setNotificationState('denied');
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationState('enabled');
      new Notification('TrendForge notifications enabled', {
        body: 'You can now use this device to receive TrendForge alerts when push delivery is connected.',
      });
    } else {
      setNotificationState('denied');
    }
  }

  const notificationLabel =
    notificationState === 'enabled'
      ? 'Alerts enabled ✓'
      : notificationState === 'denied'
        ? 'Alerts blocked'
        : notificationState === 'unsupported'
          ? 'Alerts unavailable'
          : 'Get notified';

  return (
    <section className="subscribe-panel" aria-label="TrendForge subscription options">
      <div className="subscribe-copy">
        <div className="eyebrow">Stay ahead</div>
        <h2>Get the signal.<br /><span>Skip the noise.</span></h2>
        <p>Subscribe to TrendForge and keep up with useful AI, technology and digital-life stories.</p>
      </div>
      <div className="subscribe-actions">
        <a className="subscribe-button" href={`${basePath}/feed.xml`} target="_blank" rel="noreferrer">
          Subscribe via RSS <span>↗</span>
        </a>
        <button className="notify-button" type="button" onClick={enableNotifications} disabled={notificationState === 'enabled' || notificationState === 'unsupported'}>
          <span className="bell">◔</span> {notificationLabel}
        </button>
        <small>RSS works with Feedly, Inoreader and most RSS readers. Browser alerts are prepared for push delivery.</small>
      </div>
    </section>
  );
}
