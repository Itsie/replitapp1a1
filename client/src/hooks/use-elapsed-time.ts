import { useState, useEffect } from 'react';

/**
 * Hook to calculate elapsed time for a running time slot
 * @param startedAt - The timestamp when the slot started
 * @param status - Current status of the slot
 * @returns Elapsed time in minutes
 */
export function useElapsedTime(startedAt: Date | null, status: string): number {
  const [elapsedMin, setElapsedMin] = useState(0);

  useEffect(() => {
    if (status !== 'RUNNING' || !startedAt) {
      setElapsedMin(0);
      return;
    }

    const calculateElapsed = () => {
      const now = Date.now();
      const start = new Date(startedAt).getTime();
      const elapsedMs = now - start;
      const minutes = Math.floor(elapsedMs / 60000);
      setElapsedMin(minutes);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startedAt, status]);

  return elapsedMin;
}
