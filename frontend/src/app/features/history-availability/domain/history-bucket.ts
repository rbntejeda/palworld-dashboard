export type HistoryBucketId = 'hour' | 'day';

export interface HistoryBucketOption {
  id: HistoryBucketId;
  label: string;
}

export const HISTORY_BUCKET_OPTIONS: HistoryBucketOption[] = [
  { id: 'hour', label: 'Hora' },
  { id: 'day', label: 'Día' }
];
