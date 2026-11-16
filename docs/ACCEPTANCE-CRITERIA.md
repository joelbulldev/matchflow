# Acceptance criteria

## Plugin fidelity

- [ ] Plugin activates on clean WordPress without fatals
- [ ] Tables created (schema version stored)
- [ ] Settings → MATCHFLOW loads
- [ ] ZIP install works without custom Nginx
- [ ] `/app/overview` refresh works
- [ ] `/wp-admin` and `/wp-json` remain available for operators/API internals

## Product

- [ ] Create org + membership owner
- [ ] Create/issue invoice + public `/pay/{token}`
- [ ] Create PO, GRN, bill; match flags 120/100/120 discrepancy
- [ ] Approval dual-control blocks self-approve
- [ ] Settlement quote path uses shared engine
- [ ] Status signature failure cannot reconcile SUCCESS
- [ ] Dashboard metrics from DB only

## Settlement

- [ ] dry quote preview never settles
- [ ] executable quote stores deposit address
- [ ] SUCCESS + validation updates obligation once
