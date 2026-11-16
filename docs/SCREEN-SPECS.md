# Screen specs (summary)

Every data screen implements: loading skeleton, empty, populated, error/retry, 403, 404, mobile layout.

## Overview

Purpose: executive money snapshot. Data: `GET /dashboard/summary`. Actions: create invoice, upload bill, create PO.

## Invoice list / create

Purpose: AR collection. Data: invoices CRUD + issue. Create uses editor + live preview.

## Checkout

Purpose: public payment without account. Data: public invoice + quotes. Never exposes internal notes.

## Bill match

Purpose: three-way comparison. Data: `POST /payables/bills/{id}/match`. Shows discrepancies and financial impact.
