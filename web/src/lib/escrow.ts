/**
 * Minimal Escrow.com client for Fellowship Focus stakes.
 * Same API pattern as cessionpro/lib/escrow.ts — env-gated.
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

function base(): string {
  return isSandbox()
    ? `https://api.escrow-sandbox.com/${API_VERSION}`
    : `https://api.escrow.com/${API_VERSION}`;
}

export function escrowConfigured(): boolean {
  return Boolean(escrowEmail() && escrowKey());
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
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Escrow API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function ensureEscrowCustomer(email: string): Promise<void> {
  try {
    await escrowFetch("/customer", {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: "Fellowship",
        last_name: "Member",
        address: { line1: "1 Quest Lane", city: "Rivendell", region: "ME", country: "US", post_code: "04001" },
      }),
    });
  } catch {
    /* already registered */
  }
}

export type EscrowTransaction = {
  id: number;
  parties: { customer: string; role: string }[];
};

/** Simple 2-party stake: member deposits, broker holds until settlement */
export async function createStakeDeposit(input: {
  memberEmail: string;
  description: string;
  amountEur: number;
}): Promise<EscrowTransaction> {
  const broker = escrowEmail() || "me";
  await ensureEscrowCustomer(input.memberEmail);
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
          description: "Weekly habit challenge stake — Fellowship Focus",
          type: "domain_name",
          inspection_period: 7 * 86400,
          quantity: 1,
          schedule: [
            { amount: input.amountEur, payer_customer: input.memberEmail, beneficiary_customer: broker },
          ],
        },
      ],
    }),
  });
}

export function escrowTransactionUrl(id: string | number): string {
  return isSandbox()
    ? `https://www.escrow-sandbox.com/transaction/${id}`
    : `https://www.escrow.com/transaction/${id}`;
}
