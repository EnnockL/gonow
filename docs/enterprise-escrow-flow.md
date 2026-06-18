# Gonow Enterprise Escrow Flow

Det här dokumentet beskriver hur Gonow ska tänka kring `Stripe`, `Swish`, `escrow`, `driver wallet` och `payouts` på enterprise-nivå.

## Grundprincip

Betalmetoden får aldrig vara källan till sanningen.

I stället gäller:

- `orders` beskriver uppdraget
- `payments` beskriver kundens betalning
- `escrow_ledger` beskriver pengarnas riktiga rörelse
- `payouts` beskriver utbetalningen till förare
- `disputes` fryser eller omdirigerar pengar vid problem

## Flöde 1: normal kundbetalning

1. Kund bokar en resa eller leverans
2. Förare accepterar
3. Order går till `payment_pending`
4. Kund betalar med `stripe` eller `swish`
5. Webhook markerar `payments.status = paid`
6. Trigger skapar ledger-rader:
   - `customer_payment_received`
   - `platform_fee_reserved`
   - `carrier_payout_reserved`
7. Order går till `paid_held`

## Flöde 2: leverans klar

1. Förare markerar `picked_up`
2. Förare markerar `in_transit`
3. Förare markerar `delivered`
4. Mottagare bekräftar
5. Order går till `confirmed`
6. Trigger skapar `carrier_available`
7. Order går till `payout_ready`

## Flöde 3: payout till förare

1. Systemet skapar en rad i `payouts`
2. `payouts.status = pending` eller `processing`
3. Ledger får `carrier_payout_processing`
4. När payout är klar sätts `payouts.status = paid`
5. Ledger får `carrier_payout_paid`
6. Order går till `paid_out`

## Flöde 4: tvist

1. Kund eller förare öppnar `dispute`
2. Order går till `disputed`
3. Ledger får `dispute_hold`
4. Payout stoppas tills tvisten är löst

## Hur Stripe passar in

Stripe används primärt för:

- checkout
- payment intent
- webhook
- payout via Stripe Connect

Rekommenderat webhook-beteende:

- `checkout.session.completed`
  - hitta order
  - sätt payment till `paid`
  - låt trigger bygga escrow-entries

- `payment_intent.succeeded`
  - säkerställ `paid`
  - uppdatera metadata

- `payment_intent.payment_failed`
  - sätt payment till `failed`
  - låt order ligga kvar i `payment_pending`

- `transfer.created` eller payout-event
  - uppdatera `payouts.status`

## Hur Swish passar in

Swish är bara en annan `payment provider`.

Det betyder:

- samma `orders`
- samma `escrow_ledger`
- samma `payouts`
- samma `wallet`

Enda skillnaden är vem som skickar betalbekräftelsen:

- Stripe webhook
- Swish callback / status endpoint

När Swish säger att kund betalade:

- `payments.provider = swish`
- `payments.status = paid`
- resten av flödet är identiskt

## Driver wallet

Förarens panel ska visa fyra huvudsiffror:

- `På hold`
  - betalda uppdrag som inte är helt färdiga

- `Tillgängligt`
  - levererade och bekräftade uppdrag klara för payout

- `På väg ut`
  - payouts som är skapade men inte klara

- `Utbetalt`
  - historiskt utbetalda pengar

De siffrorna ska i längden räknas från `escrow_ledger`, inte från bara `orders.status`.

## Rekommenderad rollout

1. Kör `supabase/enterprise-payments.sql`
2. Flytta checkout till att skapa `payments`
3. Låt Stripe webhook uppdatera `payments`
4. Läs saldo från `escrow_ledger`
5. Lägg på payout-jobb
6. Lägg till Swish ovanpå samma struktur

## Viktig kompatibilitetsnotis

Live-miljön verkar ha både `carrier_id` och `receiver_id`-logik blandad i olika delar.

Därför:

- ny migration behåller båda
- `fn_resolve_order_carrier_id()` används som säker bro
- när all kod är migrerad kan ni standardisera helt

