# MATCHFLOW design system

Built on **shadcn/ui (New York)** + **Radix primitives** + Matchflow domain components. ReUI-style composition: primitives in `components/ui`, product patterns in `components/matchflow`.

## Rule

Screens must import from:

- `@/components/ui/*` — primitives (Button, Input, Select, DropdownMenu, Dialog, Tabs, Table, …)
- `@/components/matchflow` — product patterns (PageHeader, DataTable, AmountDisplay, StatusBadge, QuoteCard, …)

Do **not** invent one-off buttons, tables, badges, or dropdowns inside pages.

## Tokens

CSS variables in `resources/app/src/styles.css` (teal primary, slate surfaces). Typography: **Plus Jakarta Sans** + **IBM Plex Mono** (money).

## Primitives (`components/ui`)

Button, Input, Textarea, Label, Card, Badge, Separator, DropdownMenu, Select, Dialog, Tabs, Table, Skeleton, Alert, Tooltip, Progress, Checkbox, Switch, ScrollArea

Dropdown/Select carets use Radix `ChevronDown` inside the trigger — never manually absolute-positioned carets.

## Domain (`components/matchflow`)

PageHeader, AmountDisplay, StatusBadge, MetricCard, EmptyState, ErrorState, LoadingBlock, DataTable, QuoteCard, MatchResultCard, SettlementTimeline, EvidenceChain, FormField, CreateLinkButton

## Shells

`WorkspaceShell` uses DropdownMenu for Create + account menus with correctly aligned Radix content (`align="end"`, `sideOffset`).
