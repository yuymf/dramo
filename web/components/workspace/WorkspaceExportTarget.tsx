"use client";

import { createContext } from "react";

// Keep the active document/export hook owned by its editor when moving the entry.
export const WorkspaceExportTarget = createContext<HTMLDivElement | null>(null);
