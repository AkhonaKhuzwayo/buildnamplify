import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getSouthAfricaDateKey } from './dateKey';

export interface SystemMetricsUpdate {
  activationsCount?: number;
  activationsEarnings?: number;
  loginCount?: number;
  clockInCount?: number;
  clockOutCount?: number;
}

export async function recordSystemMetrics(update: SystemMetricsUpdate): Promise<void> {
  const dailyDateKey = getSouthAfricaDateKey();
  const dailyRef = doc(db, 'system_metrics', `daily_${dailyDateKey}`);
  const overallRef = doc(db, 'system_metrics', 'overall');

  const dailyPayload: Record<string, unknown> = {
    dateKey: dailyDateKey,
    updatedAt: serverTimestamp()
  };
  const overallPayload: Record<string, unknown> = {
    updatedAt: serverTimestamp()
  };

  if (update.activationsCount) {
    dailyPayload.activationsCount = increment(update.activationsCount);
    overallPayload.totalActivationsCount = increment(update.activationsCount);
  }
  if (update.activationsEarnings) {
    dailyPayload.activationsEarnings = increment(update.activationsEarnings);
    overallPayload.totalActivationsEarnings = increment(update.activationsEarnings);
  }
  if (update.loginCount) {
    dailyPayload.loginCount = increment(update.loginCount);
    overallPayload.totalLoginCount = increment(update.loginCount);
  }
  if (update.clockInCount) {
    dailyPayload.clockInCount = increment(update.clockInCount);
    overallPayload.totalClockInCount = increment(update.clockInCount);
  }
  if (update.clockOutCount) {
    dailyPayload.clockOutCount = increment(update.clockOutCount);
    overallPayload.totalClockOutCount = increment(update.clockOutCount);
  }

  await Promise.all([
    setDoc(dailyRef, dailyPayload, { merge: true }),
    setDoc(overallRef, overallPayload, { merge: true })
  ]);
}
