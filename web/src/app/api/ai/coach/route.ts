import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { GUILD_NICHES } from "@/lib/db";

/**
 * Gemini coach: domains (+ visit counts) → categories & starter plan.
 * Never send full URLs — only aggregated domains.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const domains = Array.isArray(body.domains)
      ? (body.domains as Array<{ domain: string; visits?: number; score?: number }>).slice(0, 40)
      : [];
    if (!domains.length) {
      return NextResponse.json({ error: "domains_required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // Deterministic fallback without AI
      return NextResponse.json({ coach: heuristicCoach(domains), source: "heuristic" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a productivity coach for a website blocker app.
Given browsing domains (domain + visit counts), propose:
1) categories to block (social, video, news, shopping, games, other)
2) a starter blocklist (max 15 domains from the input)
3) one recommended timer preset: pomodoro(25/5), desk52(52/17), deep45(45/5), sprint20(20/5), or hour(60/10)
4) one short sentence of advice

Return STRICT JSON only:
{"categories":[{"id":"social","domains":["x.com"]}],"blocklist":["x.com"],"preset":"pomodoro","advice":"..."}

Domains:
${domains.map((d) => `${d.domain}: ${d.visits ?? 0} visits`).join("\n")}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const text = result.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ coach: heuristicCoach(domains), source: "heuristic" });
    }
    const coach = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ coach, source: "gemini" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "coach_failed" }, { status: 500 });
  }
}

function heuristicCoach(domains: Array<{ domain: string; visits?: number; score?: number }>) {
  const buckets: Record<string, string[]> = {
    social: [],
    video: [],
    news: [],
    shopping: [],
    games: [],
    other: [],
  };
  const social = ["x.com", "twitter.com", "reddit.com", "instagram.com", "facebook.com", "tiktok.com", "linkedin.com"];
  const video = ["youtube.com", "netflix.com", "twitch.tv"];
  const news = ["cnn.com", "bbc.com", "news.google.com"];
  const shopping = ["amazon.com", "ebay.com"];
  const games = ["roblox.com", "store.steampowered.com"];

  for (const d of domains) {
    const dom = d.domain;
    if (social.some((s) => dom === s || dom.endsWith(`.${s}`))) buckets.social.push(dom);
    else if (video.some((s) => dom === s || dom.endsWith(`.${s}`))) buckets.video.push(dom);
    else if (news.some((s) => dom === s || dom.endsWith(`.${s}`))) buckets.news.push(dom);
    else if (shopping.some((s) => dom === s || dom.endsWith(`.${s}`))) buckets.shopping.push(dom);
    else if (games.some((s) => dom === s || dom.endsWith(`.${s}`))) buckets.games.push(dom);
    else if ((d.score || 0) >= 20 || (d.visits || 0) >= 30) buckets.other.push(dom);
  }

  const categories = Object.entries(buckets)
    .filter(([, list]) => list.length)
    .map(([id, list]) => ({ id, domains: list }));
  const blocklist = categories.flatMap((c) => c.domains).slice(0, 15);
  return {
    categories,
    blocklist,
    preset: blocklist.length >= 8 ? "deep45" : "pomodoro",
    advice: "Block your top distractors first, then lock a 45-minute deep-work cycle.",
    niches: GUILD_NICHES.map((n) => n.id),
  };
}
