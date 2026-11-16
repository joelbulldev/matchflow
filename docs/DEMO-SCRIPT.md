# MATCHFLOW judge demo script

Deadline: **2026-11-14T23:59:00Z**

## AP hero (primary)

1. Sign in → create workspace if needed.
2. Create supplier with verified settlement address.
3. Create PO for solar equipment: qty **120** @ **$20**.
4. Record goods receipt for qty **100**.
5. Create supplier bill invoicing qty **120** @ **$20**.
6. Run three-way match → expect **exception** with **$400** unjustified impact.
7. Correct bill to qty **100** → match **passed**.
8. Submit approval (second user approves under dual-control).
9. Prepare AP settlement quote (dry first, then executable).
10. Deposit → poll until **SUCCESS** → open receipt / explorer links.

## AR aside (secondary)

1. Create customer → create invoice → issue payment link.
2. Open `/pay/{token}` → dry quote → (optional) executable small collection.
3. Track `/pay/{token}/status` until terminal SUCCESS → receipt.

## Notes

- MATCHFLOW never custodies funds.
- Wallet popup success is **not** settlement proof — only verified 1Click **SUCCESS** reconciles.
- Live SUCCESS requires NEAR Intents credentials in env / wp-admin settings.
