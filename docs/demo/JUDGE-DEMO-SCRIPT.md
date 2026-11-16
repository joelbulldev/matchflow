# Judge demo script (~5 minutes)

**Story:** Evidence → obligation → **wallet pay** → signed settlement → receipt (MATCHFLOW + NEAR Intents).

## 1. AR hero (90s)

1. Workspace → **Invoices** → open issued invoice → copy **payment link**.
2. Open pay link (incognito): branded checkout, amount, due date.
3. **Connect** NEAR wallet (refund + payer).
4. **Get deposit address** → verify quote signature server-side (no error toast).
5. **Pay with wNEAR** (or native NEAR) → wallet sign → “Deposit submitted”.
6. **Track status** → live poll until **SUCCESS** → invoice paid.
7. **Receipt** → destination tx + reconciled timestamp.

Say: *“We never custody funds. The payer signs in their wallet; 1Click routes the intent; we only reconcile on signed SUCCESS.”*

## 2. AP aside (60s, optional)

Payables → bill match → approval → settlement drawer → same Intents pipeline to supplier destination.

## 3. Differentiators (30s)

- Verified 1Click quote + status signatures (fail-closed).
- Shared settlement engine AR + AP.
- Three-way match + policy on payables.

## Before recording

Run `docs/demo/LIVE-NEAR-SMOKE.md` once on production with a **small** mainnet amount.