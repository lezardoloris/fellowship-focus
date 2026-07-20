import { NextResponse } from "next/server";

const GITHUB_REPO = "lezardoloris/fellowship-focus";

type Asset = { name: string; browser_download_url: string };

async function resolveAsset(): Promise<{ url: string; filename: string } | null> {
  const override = process.env.WINDOWS_DOWNLOAD_URL?.trim();
  if (override) {
    return {
      url: override,
      filename: override.split("/").pop() || "FellowshipFocus-Windows.zip",
    };
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "FellowshipFocus" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { assets: Asset[] };
  const winAsset =
    data.assets.find((a) => /\.exe$/i.test(a.name)) ??
    data.assets.find((a) => /\.msi$/i.test(a.name)) ??
    data.assets.find((a) => /windows/i.test(a.name) && /\.zip$/i.test(a.name)) ??
    data.assets.find((a) => /\.zip$/i.test(a.name));

  if (!winAsset) return null;
  return { url: winAsset.browser_download_url, filename: winAsset.name };
}

/**
 * Direct download for end users — URL stays on Railway.
 * Storage can be GitHub Releases or WINDOWS_DOWNLOAD_URL (CDN).
 */
export async function GET() {
  try {
    const asset = await resolveAsset();
    if (!asset) {
      return NextResponse.json(
        { error: "Windows build not published yet. Check back soon." },
        { status: 404 }
      );
    }

    // 302 to the file CDN — browser downloads without visiting github.com UI
    return NextResponse.redirect(asset.url, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": `attachment; filename="${asset.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Download temporarily unavailable" }, { status: 502 });
  }
}
