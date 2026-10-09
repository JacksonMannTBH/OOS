export const LEARNING_THRESHOLD_DAYS = 30;

export type LearningState = {
  /** ISO timestamp of the first sample ever ingested. null = nothing seen yet. */
  firstSampleIso: string | null;
  /** Whole days elapsed since firstSampleIso, capped at LEARNING_THRESHOLD_DAYS. */
  daysElapsed: number;
  /** Whole days remaining to reach LEARNING_THRESHOLD_DAYS. 0 once we cross the line. */
  daysRemaining: number;
  /** 0..1 fraction of the learning window completed. */
  progress: number;
  /** True until daysElapsed >= LEARNING_THRESHOLD_DAYS. */
  stillLearning: boolean;
};
