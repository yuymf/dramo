import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

/**
 * Debug endpoint: shows what the server sees in your session.
 * Visit http://localhost:12323/api/debug/session in your browser after login.
 * DELETE THIS FILE after debugging is done.
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  const tokenPayload = session?.backendToken
    ? (() => {
        try {
          const parts = session.backendToken.split(".");
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          const now = Math.floor(Date.now() / 1000);
          return {
            userId: payload.userId ?? payload.sub,
            email: payload.email,
            iat: payload.iat,
            exp: payload.exp,
            expiresInSeconds: payload.exp - now,
            isExpired: payload.exp < now,
          };
        } catch {
          return { error: "could not decode token" };
        }
      })()
    : null;

  return NextResponse.json({
    sessionExists: !!session,
    userInSession: session?.user ?? null,
    backendTokenPresent: !!session?.backendToken,
    backendTokenPrefix: session?.backendToken?.slice(0, 40) ?? null,
    backendTokenPayload: tokenPayload,
    sessionExpires: session?.expires ?? null,
  });
}
