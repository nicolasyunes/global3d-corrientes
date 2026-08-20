# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (responsive, mobile-first)

## Users

The owner/operator of Global3D, a small 3D-printing business in Argentina. One person wears every hat — they capture orders, run the printers, and reconcile money. They reach the app in three scenes:

- **On the street / in the workshop** (mobile): loading a new order from a social inquiry, one-handed, often outdoors in bright light.
- **At the shop** (mobile or tablet): checking today's queue and due dates between print jobs.
- **At home** (desktop): refining order details and reviewing the day.

## Product Purpose

An internal workshop management app that replaces the operator's spreadsheet. It turns a WhatsApp/Facebook/Instagram inquiry into a trackable order in seconds, then keeps every due date, status, and pending balance visible until the job is delivered. Success is measured in capture speed and trust: the operator can enter an order without breaking their flow, and never loses track of what is due.

## Positioning

The only tool built for how this operator actually works: capture happens in the street, in a single thumb-reachable screen, before the inquiry scrolls away. The order is the crown jewel — everything else (agenda, kanban, finance) is layered on top of a fast, reliable capture surface.

## Operating Context

- Orders arrive as social messages (Facebook, WhatsApp, Instagram) and are transcribed **manually** — no social/API integration in v1.
- `origin_channel` is recorded for channel-mix tracking, not integration.
- Deliveries run on **agreed due dates**, not timestamps; `due_date` is the critical sort field.
- Deposits ("seña") arrive in installments over time; the stored `pending_balance` is the source of truth and may differ from `total − deposit` by design.
- The operator is Spanish-speaking; the business runs in Argentina (ARS amounts, local payment rails: cash, transfer, Ualá, Brubank, Mercado Pago).

## Capabilities and Constraints

- **Stack**: Vite + React + TypeScript + Supabase (PostgreSQL). Supabase RLS is the security boundary; the anon key is public by design.
- **Deliverables**: (1) this internal workshop app under `/admin/*`, (2) a public catalog under `/` with WhatsApp checkout (separate work).
- **Clean UI**: no nested boxes, no decorative overload; surfaces separated by spacing and token backgrounds.
- **Official palette**: Global3D orange `#F37021`, carbon `#1D1D1B`, white `#FFFFFF`, teal accent `#0E7C66`. Light-gray `#F0F0F0` is retired.
- **Explicitly deferred** (future changes): auth login UI (magic link + `handle_new_user`), social API integration, PWA/offline, urgency agenda, kanban board, finance registry.

## Brand Commitments

- **Name**: Global3D.
- **Palette**: the official brand colors above are binding; they override the earlier approximate palette in the original requirements doc.
- **Logo**: a text wordmark "Global3D" (placeholder until the owner provides the final logo asset — shape/icon still undescribed).

## Evidence on Hand

Greenfield — no real customer, order, or financial data exists yet. No testimonial, benchmark, or case study may be fabricated. Demo content must be labeled synthetic.

## Product Principles

1. **Capture speed wins.** If an order takes more than a few taps on a phone, the design is wrong.
2. **Clean and direct.** No boxes inside boxes; the interface disappears into the task.
3. **Mobile-first, desktop-capable.** Optimize for the street scene first; wider viewports only ever add structure.
4. **The brief beats decoration.** A pinned clean, direct brief overrides any "bolder" default.
5. **Supabase is truth.** Orders, customers, and balances live in the database; RLS — not app logic — enforces who sees what.

## Accessibility & Inclusion

- Touch targets ≥ 44px; single-column layout with no horizontal scroll at 320px.
- WCAG AA contrast; the operator works outdoors in bright light, so text contrast is non-negotiable.
- Native controls (date picker, tel/decimal keyboards) over custom widgets.
