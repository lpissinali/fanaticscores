'use client';
import { useAnalytics } from '../../../lib/useAnalytics';

export default function AnalyticsProvider() {
  useAnalytics();
  return null;
}
