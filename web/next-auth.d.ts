import "next-auth";
import type { PlanId } from "@/lib/billing/types";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
    backendToken?: string;
    planId?: PlanId;
  }

  interface User {
    backendToken?: string;
    planId?: PlanId;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    planId?: string;
  }
}
