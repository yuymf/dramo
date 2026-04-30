export interface PlanLimit {
  projects: number | null;       // null = unlimited
  characters: number | null;
  aiGenerations: number | null;
}

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free:       { projects: 1,    characters: 5,    aiGenerations: 10   },
  starter:    { projects: 10,   characters: 50,   aiGenerations: 100  },
  pro:        { projects: null, characters: null,  aiGenerations: null },
  enterprise: { projects: null, characters: null,  aiGenerations: null },
};

export function getPlanLimits(planId: string): PlanLimit {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
}
