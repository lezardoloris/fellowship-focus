import { NextResponse } from "next/server";
import { authProviders } from "@/auth";

/** Which OAuth providers are configured on this deployment. */
export async function GET() {
  return NextResponse.json({
    google: authProviders.google,
    github: authProviders.github,
  });
}
