/**
 * Escrow.com client for Fellowship Focus goal bets / weekly stakes.
 * Auth = HTTP Basic (ESCROW_EMAIL:ESCROW_API_KEY). Sandbox when ESCROW_SANDBOX=1.
 */

const API_VERSION = "2017-09-01";

function isSandbox(): boolean {
  return process.env.ESCROW_SANDBOX === "1";
}

function escrowEmail(): string | undefined {
  return isSandbox()
    ? process.env.ESCROW_SANDBOX_EMAIL || process.env.ESCROW_EMAIL
    : process.env.ESCROW_EMAIL;
}

function escrowKey(): string | undefined {
  return isSandbox()
    ? process.env.ESCROW_SANDBOX_KEY || process.env.ESCROW_API_KEY
    : process.env.ESCROW_API_KEY;
}

function brokerCustomer(): string {
  return escrowEmail() || "me";
}

function base(): string {
  return isSandbox()
    ? `https://api.escrow-sandbox.com/${API_VERSION}`
    : `https://api.escrow.com/${API_VERSION}`;
}

export function escrowConfigured(): boolean {
  return Boolean(escrowEmail() && escrowKey());
}

export function escrowIsSandbox(): boolean {
  return isSandbox();
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${escrowEmail()}:${escrowKey()}`).toString("base64")}`;
}

async function escrowFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Escrow API ${res.status}: ${body.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function ensureEscrowCustomer(email: string): Promise<void> {
  try {
    await escrowFetch("/customer", {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: "Fellowship",
        last_name: "Member",
        address: {
          line1: "1 Quest Lane",
          city: "Rivendell",
          region: "ME",
          country: "US",
          post_code: "04001",
        },
      }),
    });
  } catch {
    /* already registered */
  }
}

export type EscrowTransaction = {
  id: number;
  is_cancelled?: boolean;
  parties: { customer: string; role: string; agreed?: boolean }[];
  items?: {
    id?: number;
    type?: string;
    status?: {
      accepted?: boolean;
      shipped?: boolean;
      received?: boolean;
      canceled?: boolean;
      secured?: boolean;
    };
    schedule?: { amount: string | number; status?: { secured?: boolean; disbursed_to_beneficiary?: boolean } }[];
  }[];
};

export async function getEscrowTransaction(id: string | number): Promise<EscrowTransaction> {
  return escrowFetch<EscrowTransaction>(`/transaction/${id}`);
}

async function patchTransaction(id: string | number, body: Record<string, unknown>): Promise<EscrowTransaction> {
  return escrowFetch<EscrowTransaction>(`/transaction/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** True when buyer funds are secured in escrow. */
export function fundsSecured(t: EscrowTransaction): boolean {
  const item = t.items?.find((i) => i.type !== "broker_fee") ?? t.items?.[0];
  if (!item) return false;
  if (item.schedule?.some((s) => s.status?.secured)) return true;
  return Boolean(item.status && "secured" in item.status && item.status.secured);
}

/** Member deposits; platform broker holds until settlement. */
export async function createStakeDeposit(input: {
  memberEmail: string;
  description: string;
  amountEur: number;
}): Promise<EscrowTransaction> {
  const broker = brokerCustomer();
  await ensureEscrowCustomer(input.memberEmail);
  const amount = Number(input.amountEur.toFixed(2));
  return escrowFetch<EscrowTransaction>("/transaction", {
    method: "POST",
    body: JSON.stringify({
      parties: [
        { role: "buyer", customer: input.memberEmail },
        { role: "seller", customer: broker },
        { role: "broker", customer: broker },
      ],
      currency: "eur",
      description: input.description.slice(0, 200),
      items: [
        {
          title: input.description.slice(0, 100),
          description: "Fellowship Focus goal bet — funds held until week settlement",
          type: "general_merchandise",
          inspection_period: 3 * 86400,
          quantity: 1,
          schedule: [
            {
              amount,
              payer_customer: input.memberEmail,
              beneficiary_customer: broker,
            },
          ],
        },
      ],
    }),
  });
}

/** Broker pays a winner their share of the loser pot. */
export async function createPotPayout(input: {
  winnerEmail: string;
  amountEur: number;
  description: string;
}): Promise<EscrowTransaction> {
  const broker = brokerCustomer();
  await ensureEscrowCustomer(input.winnerEmail);
  const amount = Number(input.amountEur.toFixed(2));
  if (amount < 0.5) {
    throw new Error("Payout too small");
  }
  return escrowFetch<EscrowTransaction>("/transaction", {
    method: "POST",
    body: JSON.stringify({
      parties: [
        { role: "buyer", customer: broker },
        { role: "seller", customer: input.winnerEmail },
        { role: "broker", customer: broker },
      ],
      currency: "eur",
      description: input.description.slice(0, 200),
      items: [
        {
          title: "Fellowship Focus pot share",
          description: input.description.slice(0, 200),
          type: "general_merchandise",
          inspection_period: 86400,
          quantity: 1,
          schedule: [
            {
              amount,
              payer_customer: broker,
              beneficiary_customer: input.winnerEmail,
            },
          ],
        },
      ],
    }),
  });
}

/** Goal met — cancel as partner/broker so the buyer's stake is returned. */
export async function refundStakeDeposit(txId: string | number): Promise<EscrowTransaction> {
  return patchTransaction(txId, {
    action: "cancel",
    cancel_information: {
      cancellation_reason: "Goal met — stake returned by Fellowship Focus",
    },
  });
}

/**
 * Goal missed — ship as seller then try receive/accept so funds disburse to broker.
 * Escrow may still require the buyer to click receive; we record failures for manual follow-up.
 */
export async function captureStakeDeposit(txId: string | number): Promise<{
  ok: boolean;
  step: string;
  error?: string;
  tx?: EscrowTransaction;
}> {
  try {
    let tx = await patchTransaction(txId, {
      action: "ship",
      shipping_information: {
        tracking_information: {
          tracking_number: `FF-${txId}`,
          carrier_other: "Fellowship Focus digital settle",
        },
      },
    });
    try {
      tx = await patchTransaction(txId, { action: "receive" });
      tx = await patchTransaction(txId, { action: "accept" });
      return { ok: true, step: "accepted", tx };
    } catch (e) {
      return {
        ok: false,
        step: "shipped_awaiting_buyer",
        error: e instanceof Error ? e.message : "receive/accept failed",
        tx,
      };
    }
  } catch (e) {
    return {
      ok: false,
      step: "ship_failed",
      error: e instanceof Error ? e.message : "ship failed",
    };
  }
}

export function escrowTransactionUrl(id: string | number): string {
  return isSandbox()
    ? `https://www.escrow-sandbox.com/transaction/${id}`
    : `https://www.escrow.com/transaction/${id}`;
}

export function escrowAccountUrl(): string {
  return isSandbox() ? "https://www.escrow-sandbox.com/" : "https://www.escrow.com/";
}

/** Agree link for the member (buyer) to accept terms before funding. */
export async function getAgreeLink(txId: string | number): Promise<string | null> {
  try {
    const res = await escrowFetch<{ landing_page?: string }>(`/transaction/${txId}/web_link/agree`);
    return res?.landing_page ?? null;
  } catch {
    return null;
  }
}
