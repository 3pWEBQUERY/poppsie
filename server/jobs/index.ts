/**
 * Registry der Job-Handler (einmalige Jobs aus der Queue) und periodischen Aufgaben.
 * Jedes Modul pflegt seine eigene Datei; hier wird nur zusammengeführt.
 */
import * as account from "./account";
import * as analytics from "./analytics";
import * as bookings from "./bookings";
import * as planner from "./planner";
import * as savedSearches from "./saved-searches";
import type { JobHandler, Periodic } from "./types";

export type { JobHandler, Periodic } from "./types";

const modules = [account, analytics, bookings, planner, savedSearches];

export const HANDLERS: Record<string, JobHandler> = Object.assign({}, ...modules.map((m) => m.handlers));

export const PERIODIC: Periodic[] = modules.flatMap((m) => m.periodic);
