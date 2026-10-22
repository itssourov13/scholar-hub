import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const label =
    process.env.OPENROUTER_MODEL_LABEL ??
    process.env.OPENROUTER_MODEL ??
    process.env.NEXT_PUBLIC_OPENROUTER_MODEL_LABEL ??
    process.env.NEXT_PUBLIC_OPENROUTER_MODEL ??
    process.env.NIM_MODEL_LABEL ??
    process.env.NIM_MODEL ??
    "deepseek/deepseek-v4-flash";

  const fallbackLabel =
    process.env.OPENROUTER_FALLBACK_MODEL_LABEL ??
    process.env.OPENROUTER_FALLBACK_MODEL ??
    null;

  return NextResponse.json({
    chatModelLabel: label,
    chatModelFallbackLabel: fallbackLabel,
  });
}
