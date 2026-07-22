import { NextResponse } from "next/server";
import {
  getBlocklist,
  getBlockerSettings,
  getMemberByToken,
  listBlockerDevices,
  logBypassEvent,
  replaceBlocklist,
  setBlockerSettings,
  upsertBlockerDevice,
} from "@/lib/db";
import { mergeBlockerSettings, type BlockerSettings } from "@/lib/blockerSettings";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function tokenOf(req: Request, body?: { token?: string }) {
  return (
    body?.token ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("token") ||
    ""
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const token = tokenOf(request);
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
  }
  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }
  const settings = getBlockerSettings(member.id);
  const sites = getBlocklist(member.id);
  const devices = listBlockerDevices(member.id);
  return NextResponse.json(
    { settings, sites, devices, member: { id: member.id, name: member.name } },
    { headers: corsHeaders }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = tokenOf(request, body);
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401, headers: corsHeaders });
    }
    const member = getMemberByToken(token);
    if (!member) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
    }

    const action = (body.action as string) || "save";

    if (action === "heartbeat") {
      const device = upsertBlockerDevice({
        memberId: member.id,
        kind: String(body.kind || "extension"),
        label: String(body.label || "Chrome"),
        shieldOn: Boolean(body.shieldOn),
        deviceId: body.deviceId ? String(body.deviceId) : undefined,
        meta: body.meta ? JSON.stringify(body.meta) : undefined,
      });
      return NextResponse.json({ device, settings: getBlockerSettings(member.id) }, { headers: corsHeaders });
    }

    if (action === "bypass") {
      logBypassEvent(member.id, String(body.kind || "unlock"), body.detail ? String(body.detail) : undefined);
      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "import") {
      if (Array.isArray(body.sites)) {
        replaceBlocklist(member.id, body.sites.map(String));
      }
      if (body.settings) {
        setBlockerSettings(member.id, mergeBlockerSettings(body.settings as Partial<BlockerSettings>));
      }
      return NextResponse.json(
        {
          settings: getBlockerSettings(member.id),
          sites: getBlocklist(member.id),
        },
        { headers: corsHeaders }
      );
    }

    // default: save settings (+ optional sites replace)
    const current = getBlockerSettings(member.id);
    const next = mergeBlockerSettings({ ...current, ...(body.settings || body) });
    setBlockerSettings(member.id, next);
    if (Array.isArray(body.sites)) {
      replaceBlocklist(
        member.id,
        body.sites.map((s: string | { site: string }) => (typeof s === "string" ? s : s.site))
      );
    }

    if (body.device) {
      upsertBlockerDevice({
        memberId: member.id,
        kind: String(body.device.kind || "web"),
        label: String(body.device.label || "Web"),
        shieldOn: Boolean(body.device.shieldOn),
        deviceId: body.device.id,
      });
    }

    return NextResponse.json(
      {
        settings: getBlockerSettings(member.id),
        sites: getBlocklist(member.id),
        devices: listBlockerDevices(member.id),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: corsHeaders });
  }
}
