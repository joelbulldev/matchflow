# MATCHFLOW route map

| Route | Shell | Access |
|---|---|---|
| `/` | Marketing | Public |
| `/login` `/register` `/forgot-password` `/reset-password` | Auth | Public |
| `/onboarding/*` | Onboarding | Authenticated |
| `/app/overview` | Workspace | Org member |
| `/app/receivables/*` | Workspace | AR capabilities |
| `/app/payables/*` | Workspace | AP capabilities |
| `/app/procurement/*` | Workspace | Procurement |
| `/app/approvals/*` | Workspace | Approvals |
| `/app/payments/*` | Workspace | Payments |
| `/app/reconciliation/*` | Workspace | Ledger |
| `/app/finance-ai` | Workspace | AI |
| `/app/reports/*` | Workspace | Reports |
| `/app/settings/*` | Workspace | Settings |
| `/pay/$token` `/pay/$token/status` | Checkout | Public token |
| `/receipt/$token` | Receipt | Public token |
| `/supplier/submit/$token` | Supplier | Public token |

Deep links and refresh are served by the plugin SPA shell via `template_include`.
