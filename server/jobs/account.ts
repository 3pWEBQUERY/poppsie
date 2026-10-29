import type { JobHandler, Periodic } from "./types";

export const handlers: Record<string, JobHandler> = {};
export const periodic: Periodic[] = [];
