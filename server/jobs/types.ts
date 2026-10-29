export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
export type Periodic = { name: string; everyMs: number; run: () => Promise<void> };
