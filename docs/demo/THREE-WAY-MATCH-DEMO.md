# Three-way match demo (hackathon video)

Use this sequence for the **$400 over-bill** story: **120 ordered · 100 received · 120 invoiced** at **$20/unit**.

## Prerequisites

- One **supplier** in Payables → Suppliers.
- Signed in with `ap.write` and `procurement.write` capabilities.

## Steps

### 1. Create purchase order

1. **Procurement → Purchase orders → Create**.
2. Pick the supplier; line defaults to **Solar equipment**, qty **120**, unit **20** (USD 2,400).
3. Save and note the PO number (detail page).

### 2. Record goods receipt

1. **Procurement → Goods received → Record delivery** (or **Record delivery** from the PO).
2. Select the PO; **received quantity = 100** (line 0).
3. Save.

### 3. Capture supplier bill (optional PDF upload)

1. **Payables → Inbox → New supplier bill**.
2. **Drop a PDF/image** in the upload zone (stored privately on the server).
3. Same supplier and **linked PO** as step 1.
4. Line: **Solar equipment**, qty **120**, unit **20** (simulates supplier over-billing by 20 units).
5. **Save & match** → opens match screen.

### 4. Run match — expect exception

1. **Run match**.
2. Expect **quantity_over_received** with **financial impact $400.00** (20 × $20).
3. Approval and settlement stay blocked while `match_status` is `exception`.

### 5. Correct and re-run

1. **Bill detail → Correct invoice lines** → set quantity to **100** → **Save lines**.
2. Return to **Match → Run match**.
3. Expect **matched** (green “no discrepancies”).

### 6. Approve and pay (optional on video tail)

1. Bill detail → **Submit approval** (or Approvals queue).
2. Second user approves if dual-control is on.
3. **Prepare settlement** → NEAR Intents quote → wallet pay → receipt.

## Honest positioning

- **Upload** = evidence attachment (`POST /files`), not automated OCR in v0.1.38.
- **Match** = deterministic rules in `MatchingEngine` (PO + GRN + bill lines).
- Line **description** must align across PO, GRN line 0, and bill (default: `Solar equipment`).

## Quick links in app

| Step | Route |
|------|--------|
| PO list | `/app/procurement/purchase-orders` |
| GRN list | `/app/procurement/goods-received` |
| AP inbox | `/app/payables/inbox` |
| Match | `/app/payables/bills/{id}/match` |