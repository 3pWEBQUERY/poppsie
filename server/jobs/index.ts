/**
 * Registry der Job-Handler (einmalige Jobs aus der Queue) und periodischen Aufgaben.
 * Module registrieren ihre Handler hier.
 */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
export type Periodic = { name: string; everyMs: number; run: () => Promise<void> };

export const HANDLERS: Record<string, JobHandler> = {};

export const PERIODIC: Periodic[] = [];
