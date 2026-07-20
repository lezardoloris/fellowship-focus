import { NextResponse } from "next/server";

const GITHUB_REPO = "lezardoloris/fellowship-focus";

type Asset = { name: string; browser_download_url: string; size?: number };

async function resolveWindowsAsset(): Promise<{
  version: string | null;
  assetUrl: string | null;
  filename: string | null;
}> {
  // Optional override — host the zip/exe anywhere (CDN, Railway volume, Blob…)
  const override = process.env.WINDOWS_DOWNLOAD_URL?.trim();
  if (override) {
    return {
      version: process.env.WINDOWS_DOWNLOAD_VERSION?.trim() || "latest",
      assetUrl: override,
      filename: override.split("/").pop() || "FellowshipFocus-Windows.zip",
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "FellowshipFocus" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { version: null, assetUrl: null, filename: null };
    }
    const data = (await res.json()) as {
      tag_name: string;
      assets: Asset[];
    };
    const winAsset =
      data.assets.find((a) => /\.exe$/i.test(a.name)) ??
      data.assets.find((a) => /\.msi$/i.test(a.name)) ??
      data.assets.find((a) => /windows/i.test(a.name) && /\.zip$/i.test(a.name)) ??
      data.assets.find((a) => /\.zip$/i.test(a.name));

    return {
      version: data.tag_name,
      assetUrl: winAsset?.browser_download_url ?? null,
      filename: winAsset?.name ?? null,
    };
  } catch {
    return { version: null, assetUrl: null, filename: null };
  }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const resolved = await resolveWindowsAsset();

  // Public response — never expose GitHub to the client
  return NextResponse.json({
    version: resolved.version,
    available: Boolean(resolved.assetUrl),
    windowsUrl: resolved.assetUrl ? `${origin}/api/download/windows` : null,
    filename: resolved.filename,
  });
}
