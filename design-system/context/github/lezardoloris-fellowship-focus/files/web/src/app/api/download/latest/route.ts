import { NextResponse } from "next/server";

const GITHUB_REPO = "lezardoloris/fellowship-focus";
const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "FellowshipFocus" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({
        version: null,
        windowsUrl: null,
        releasesPage: RELEASES_PAGE,
      });
    }
    const data = (await res.json()) as {
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };
    const winAsset =
      data.assets.find((a) => /\.exe$/i.test(a.name)) ??
      data.assets.find((a) => /\.msi$/i.test(a.name)) ??
      data.assets.find((a) => /windows/i.test(a.name) && /\.zip$/i.test(a.name));

    return NextResponse.json({
      version: data.tag_name,
      windowsUrl: winAsset?.browser_download_url ?? null,
      releasesPage: RELEASES_PAGE,
    });
  } catch {
    return NextResponse.json({
      version: null,
      windowsUrl: null,
      releasesPage: RELEASES_PAGE,
    });
  }
}
