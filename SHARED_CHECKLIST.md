# Gonow Shared Checklist

Detta är den gemensamma arbetslistan för **Codex + Claude**.

Syfte:
- jobba i samma ordning
- undvika dubbla spår
- markera vad som är `fixed` först när det är verifierat
- hålla oss till Gonows nuvarande produktvision

## Ground Rules

Innan någon ny kod skrivs ska lösningen följa:
- `CLAUDE.md`
- `project_gonow.md`

Vi bygger inte fler parallella system.
Vi färdigställer **en** sammanhängande Gonow-resa:

`package -> package_match -> payment hold -> pickup -> in transit -> delivered -> confirmed -> payout`

North Star:

`Customer books a package. Gonow takes responsibility. The package arrives.`

## Architecture Lock

Detta är låst tills vidare:

- `packages` = permanent paketidentitet och kundresa
- `package_matches` = riktad resa, accept/decline, matchning
- `orders` / `payments` = finansiell transaktion kopplad till `package_id`
- `payouts` / `escrow_ledger` = ekonomi för förare
- `booking_requests` = legacy eller migration, inte ny huvudresa

Ingen ny fix får återinföra denna kedja som primär sanning:

`booking_requests -> orders -> transport status`

Det skulle bryta `One Customer Journey`.

## Status Rules

Använd bara dessa statusvärden:

- `pending` = inte påbörjad
- `in_progress` = någon jobbar aktivt på den
- `fixed` = kod ändrad + verifierad
- `blocked` = kan inte gå vidare utan beslut eller extern ändring

En punkt får bara markeras `fixed` när den är verifierad med rätt kontroll:
- visuell kontroll om det gäller UI/text
- `npx tsc --noEmit`
- `npx next build`
- relevant smoke test om det gäller flödeslogik

## Ownership Model

Arbetsprincip:
- **Codex** tar logik, source-of-truth, auth-kedjor, legacy-isolering och slutverifiering
- **Claude** tar stora text-/UI-städrundor, repetitionsfixar och avgränsade kundytor där risk för arkitekturfel är låg
- inget arbete markeras `fixed` förrän **Codex** har verifierat det mot checklistan

Under varje punkt används:
- `Owner`
- `Support`
- `Status`

Regel:
- `Owner` gör huvudändringen
- `Support` får hjälpa till med underdelar
- bara en owner per punkt åt gången

## Source Of Truth

Huvudflöde:
- `packages`
- `package_matches`

Legacy får bara leva som fallback där det redan krävs:
- `orders`
- `booking_requests`

Mål:
- kundens huvudresa ska inte visa dubbla eller motstridiga sanningar
- kunden ska alltid känna att Gonow äger samma paket genom hela kedjan

## Current Priority Order

### 1. Profil Cleanup

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/profil/page.tsx](C:/Users/djnoc/Gonow/gonow/app/profil/page.tsx)

Definition:
- ta bort kvarvarande korrupt text
- ta bort kundsynliga krockar mellan `packages/package_matches` och legacy-data
- behåll endast legacy som dold fallback där samma resa annars skulle brytas

Klart när:
- inga kundsynliga mojibake-strängar finns kvar
- paketresa visas konsekvent
- samma paket visas inte dubbelt i huvudflödet

Handoff note:
- kundens huvudvy ska drivas av `packages + package_matches`
- legacy `booking_requests/orders` får bara ligga kvar som tyst fallback
- auth-resume mot legacy är nu bortkopplat från huvudresan
- kvar här: sista dubbla legacy-visningar och slutstädning i perifera profilsektioner

Claude text sweep (2026-07-10):
- `AI-matchning` -> `Gonow-matchning` (packages_on_route placeholder, rad 3741)
- `bärare` -> `förare` (BankID-perks x2, carriers subtitle, rad 3813/3815/3860)
- `Är` -> `är` (x10: subtitles, placeholders, hints - mojibake-kapitalfel)
- `Åka` -> `åka` (lift_on_route subtitle, rad 3747)
- `npx tsc --noEmit` OK efter sweep

Verified:
- kundens huvudvy i `/profil` drivs nu av `packages + package_matches` för den synliga paketresan
- dold kundsynlig legacy-rendering via `booking_requests/orders` har tagits bort från huvudflödet
- legacy `booking_requests` i `/profil` är nu begränsade till lift/passagerare så att paket inte visas dubbelt via gammal request-logik
- `package_offers` visas inte längre som parallell kundresa i `Mina paket`
- kundspråk justerat från `Escrow` / `Förare` / `AI:n` till mer sammanhållen Gonow-resa
- [components/matches/MatchSuggestions.tsx](C:/Users/djnoc/Gonow/gonow/components/matches/MatchSuggestions.tsx) städad från mojibake och kundsynlig AI-/förarspråk-krock
- `npx tsc --noEmit` OK
- `npx next build` OK

### 2. Skicka Language + Journey Cleanup

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/skicka/page.tsx](C:/Users/djnoc/Gonow/gonow/app/skicka/page.tsx)

Definition:
- byt ut kundspråk som bryter mot visionen
- minska exponering av förare/bärare/AI-matchning i kundresan
- tydliggör att kunden bokar med Gonow, inte med en enskild resurs

Klart när:
- kundspråket följer `CLAUDE.md`
- inga onödiga parallella ordmodeller finns kvar för samma resa

Verified:
- `npx tsc --noEmit` OK
- `npx next build` OK

### 3. Global Customer Language Cleanup

Owner: `Claude`
Support: `Codex`
Status: `fixed`

Files:
- [app/layout.tsx](C:/Users/djnoc/Gonow/gonow/app/layout.tsx)
- [components/layout/Footer.tsx](C:/Users/djnoc/Gonow/gonow/components/layout/Footer.tsx)
- [app/meddelanden/page.tsx](C:/Users/djnoc/Gonow/gonow/app/meddelanden/page.tsx)
- [app/paket/[id]/page.tsx](C:/Users/djnoc/Gonow/gonow/app/paket/[id]/page.tsx)

Definition:
- ta bort kundsynliga ord som `P2P-logistik`, `AI-matchning`, `bärare` där de inte ska synas
- justera status- och hjälptexter till Gonow-språk

Klart när:
- kundytor känns som ett transportföretag, inte ett marketplace

Verified:
- `app/layout.tsx` metadata använder Gonow-språk i stället för marketplace-/P2P-språk
- `components/layout/Footer.tsx` beskriver Gonow som transportflöde från bokning till leverans
- `/meddelanden` använder mer sammanhållet Gonow-språk och paketkontext
- `/paket/[id]` använder betalning-säkrad-hos-Gonow-språk i stället för kundsynlig escrow-jargong
- `npx tsc --noEmit` OK
- `npx next build` OK

### 4. Messaging Link Verification

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/meddelanden/page.tsx](C:/Users/djnoc/Gonow/gonow/app/meddelanden/page.tsx)
- [app/api/conversations/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/conversations/route.ts)
- [app/api/conversations/[id]/messages/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/conversations/[id]/messages/route.ts)
- [app/api/messages/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/messages/route.ts)

Definition:
- paketrelaterade meddelanden ska alltid länka till rätt paket-/spårningssida

Klart när:
- inga legacy-länkar skickar kunden till fel resa

Verified:
- paketkonversationer använder `context_id` från `conversations`
- paketbanner i `/meddelanden` länkar till `/paket/[id]`
- meddelande-API:t tar alltid användaridentiteten från verifierad access-token
- klientens `user_id` och `sender_id` används inte som behörighetsgrund
- pakettrådar kan endast läsas och skrivas av paketets avsändare eller matchade förare
- `node scripts/verify-messaging-auth.mjs` OK: 401 utan session, 403 för utomstående, förfalskad avsändare ignoreras och giltig deltagare kan läsa
- `npx tsc --noEmit` OK
- route-lint OK
- `npx next build` OK

### 5. Payment + Package State Cohesion

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/api/packages/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/route.ts)
- [app/api/orders/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/orders/route.ts)
- [app/api/orders/[id]/checkout/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/orders/[id]/checkout/route.ts)
- [app/api/webhooks/stripe/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/webhooks/stripe/route.ts)

Definition:
- säkerställ att pengar följer paketet, inte skapar en parallell transportidentitet
- webhook ska vara enda vägen till `paid`
- betalningsobjekt ska alltid vara kopplade till `package_id`

Klart när:
- package-resan och betalningsresan säger samma sak

Verified:
- `OrderStatus` stödjer nu `paid` som separat betalningssteg
- Stripe webhook uppdaterar nu `orders.status = paid` i stället för `matched`
- mock checkout uppdaterar nu legacy-order till `paid` i stället för `matched`
- mock checkout är nu dev-first: produktion returnerar tydlig `503` om Stripe saknas och `ALLOW_MOCK_CHECKOUT` inte uttryckligen är aktiverad
- `/profil` visar nu `pending = Väntar betalning`, `matched = Transport klar`, `paid = Betald`
- legacy uppdragskort för förare kan fortsätta från `paid -> picked_up`
- `/skicka` tolkar nu både legacy `pending` och gammalt `matched` som väntar betalning innan checkout
- kundspråk i `/profil` använder nu betalning säkrad hos Gonow i stället för escrow i huvudresan
- `driver summary` räknar nu `paid` och `picked_up` som aktiv leverans i samma paketresa
- `TrackingTimeline` visar nu `matched -> paid -> picked_up -> in_transit -> delivered -> confirmed`
- driver-/paketytor använder nu `Transport klar` i stället för att blanda ihop matchning med betalning
- `/api/orders` gör inte längre nested `booking_requests`-join för orders som redan är kopplade till `package_id`
- profilens kundkort använder nu `Transport klara` / `Väntar transport` i stället för att blanda ihop matchning och betalning
- delad arbetschecklista är omskriven i läsbar form för fortsatt Codex/Claude-handoff
- package-huvudresan behåller `packages + package_matches` som transport-sanning medan `orders/payments` bara driver betalningssteget
- `npx tsc --noEmit` OK
- `npx next build` OK

## Active Execution Order

Detta är ordningen vi ska följa nu:

1. `Profil Cleanup`
2. `Skicka Language + Journey Cleanup`
3. `Global Customer Language Cleanup`
4. `Messaging Link Verification`
5. `Payment + Package State Cohesion`
6. `Unified Skicka Intake`
7. `Package Lifecycle Continuity`
8. `Confirmed Package Payout Cohesion`
9. `Provider-Owned Payout Completion`

### 6. Unified Skicka Intake

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [components/booking/EnterpriseSendForm.tsx](C:/Users/djnoc/Gonow/gonow/components/booking/EnterpriseSendForm.tsx)
- [components/booking/TripBookingModal.tsx](C:/Users/djnoc/Gonow/gonow/components/booking/TripBookingModal.tsx)
- [app/api/packages/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/route.ts)
- [app/skicka/page.tsx](C:/Users/djnoc/Gonow/gonow/app/skicka/page.tsx)
- [app/auth/callback/page.tsx](C:/Users/djnoc/Gonow/gonow/app/auth/callback/page.tsx)

Definition:
- stor `/skicka`-yta och snabbmodal ska skapa samma `package`-identitet
- servern ska validera bokningskontrakt, rutt, kapacitet och pris
- kontaktuppgifter och pakettyp ska följa samma package-resa
- retry/login-resume får inte skapa ett andra paket

Verifierat 2026-07-18:
- hårdkodade adresser, telefonnummer och juni-datum borttagna från enterprise-formen
- datum visas dynamiskt
- pakettyp styr korrekt viktintervall för paket, stort paket, pall och dokument
- enterprise-formen använder `/api/distance` + `/api/price` för prisvisning
- `/api/packages` räknar om rutt och pris på servern och litar inte på klientpriset
- mottagarnamn och mottagartelefon sparas på paketet
- package-typ och request-id sparas i `tags`
- idempotent replay söker befintligt package för samma användare och request-id
- vald resa måste vara aktiv, tillåta paket och ha vikt-/paketkapacitet kvar
- auth-resume skickar samma request-id och samma package-kontrakt
- `npx tsc --noEmit` OK
- `npx next build` OK
- paketkunden väljer inte längre transport i huvudflödet
- nytt kundflöde: `Ditt paket -> Granska -> Boka -> Klart`
- granskningssidan visar rutt, pakettyp, vikt, pris samt redigerbara avsändar-/mottagaruppgifter
- bekräftelse skapar ett öppet `package` utan `trip_id`; detta blir synligt i `/uppdrag`
- bokningen startar intern ruttmatchning direkt och skapar `package_matches` som förslag för högst två relevanta aktiva resor
- ruttmatchning använder ort eller GIS-närhet för upphämtning/leverans och kontrollerar kvarvarande viktkapacitet
- matchande förare får notifiering om paket längs sin rutt
- samma package-id fortsätter från öppet uppdrag till matchning; inget `booking_request` skapas i paketflödet
- enterprise-formen och snabbmodalen använder nu samma `PendingBookingDraft`-kontrakt
- request-id, pakettyp, adresser, vikt, instruktion, leveranstid och båda kontakterna följer samma draft genom login-resume och bekräftelse
- granskningspriset hämtas från samma server-API och med samma leveranstid som `/api/packages` använder vid slutlig verifiering
- `npx tsc --noEmit` och `npx next build` OK efter gemensam draft-integration (2026-07-19)
- autentiserat Supabase-smoketest skapar isolerad kund, transportör, framtida resa, package och riktad `package_match`
- dubbel-submit med samma `Idempotency-Key` returnerar samma `package_id` med `idempotent_replay: true`
- avsändare, mottagarnamn och mottagartelefon verifieras på den sparade package-posten
- smoke-testets package, matches, trip, profiler och auth-användare städas bort efter körningen

Kvar innan `fixed`:
- inget

### 7. Package Lifecycle Continuity

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/api/packages/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/route.ts)
- [app/api/packages/[id]/driver-status/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/[id]/driver-status/route.ts)
- [app/profil/page.tsx](C:/Users/djnoc/Gonow/gonow/app/profil/page.tsx)
- [app/uppdrag/page.tsx](C:/Users/djnoc/Gonow/gonow/app/uppdrag/page.tsx)
- [scripts/verify-package-lifecycle.mjs](C:/Users/djnoc/Gonow/gonow/scripts/verify-package-lifecycle.mjs)

Definition:
- samma `package_id` ska följa matchning, betalning, upphämtning, transport, leverans och bekräftelse
- kund och förare ska hitta paketet i rätt vy under hela resan
- paketets meddelandetråd ska finnas kvar till och efter slutförd leverans
- endast betalningskedjan får flytta paketet från `matched` till `paid`

Verified 2026-07-19:
- kundens `Pågående leveranser` inkluderar nu `matched` och visar paketet direkt efter matchning
- förarens aktiva uppdrag laddar även `delivered` medan leveransen väntar på kundens bekräftelse
- föraren kan inte längre själv sätta `matched -> paid`
- privata paketlistor kräver session och servern kontrollerar att `sender_id` eller `carrier_id` tillhör sessionen
- `/uppdrag` och `/profil` använder autentiserade anrop för privata paketlistor
- autentiserat livscykeltest verifierar `paid -> picked_up -> in_transit -> delivered -> confirmed` med samma paket-ID
- samma paketmeddelande och samma `package:<id>`-tråd finns kvar genom samtliga statussteg och efter `confirmed`
- `node scripts/verify-package-lifecycle.mjs` OK
- `npx tsc --noEmit` OK
- route-lint OK
- `npx next build` OK

### 8. Confirmed Package Payout Cohesion

Owner: `Codex`
Support: `Claude`
Status: `fixed`

Files:
- [app/api/packages/[id]/driver-status/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/[id]/driver-status/route.ts)
- [app/api/packages/[id]/confirm/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/packages/[id]/confirm/route.ts)
- [app/api/payouts/[id]/route.ts](C:/Users/djnoc/Gonow/gonow/app/api/payouts/[id]/route.ts)
- [supabase/migrations/20260719_fix_payout_ready_enum.sql](C:/Users/djnoc/Gonow/gonow/supabase/migrations/20260719_fix_payout_ready_enum.sql)
- [scripts/verify-package-payout.mjs](C:/Users/djnoc/Gonow/gonow/scripts/verify-package-payout.mjs)

Definition:
- package och länkad order ska nå `confirmed` tillsammans
- förarens payout ska härledas från ordern som bär samma `package_id`
- dubbel bekräftelse eller payout-retry får inte skapa dubbla utbetalningar
- endast rätt förare får hantera sin payout

Implementerat 2026-07-19:
- package-status synkas till den länkade ordern under upphämtning, transport och leverans
- leveransbekräftelse synkar package och order samt är idempotent vid retry
- payout-statusrutten kräver session och verifierar payoutens förare
- profilens payout-anrop skickar access-token
- enum-felet i `fn_order_to_payout_ready` är korrigerat i migrationsfilen

Verified 2026-07-19:
- `20260719_fix_payout_ready_enum.sql` är applicerad i den anslutna Supabase-databasen
- package och länkad order når `confirmed` tillsammans
- leveransbekräftelsens retry återanvänder samma resultat
- payout använder orderns exakta `carrier_payout`
- payout-retry återanvänder samma payout-id och skapar inte en dublett
- en utomstående användare får `403` vid försök att ändra payout-status
- `node scripts/verify-package-payout.mjs` OK
- `npx tsc --noEmit` OK
- route-lint OK
- `npx next build` OK

Kvar innan `fixed`:
- inget

### 9. Provider-Owned Payout Completion

Owner: `Codex`
Support: `Claude`
Status: `in_progress`

Definition:
- klienten eller föraren får aldrig själv markera payout som `paid`
- endast en verifierad Stripe-webhook får slutföra eller felflagga utbetalningen
- databasfel i payout-ledger får aldrig döljas bakom HTTP 200

Implementerat 2026-07-19:
- profilens manuella `Markera klar`-knapp är borttagen
- pågående payout visas som automatiskt uppdaterad av Gonow
- klientens payout-PATCH svarar alltid `405`
- Stripe-webhook hanterar `payout.created`, `payout.updated`, `payout.paid` och `payout.failed`
- webhookens databasfel ger nu felrespons i stället för falskt lyckat svar
- enum-felet i `fn_ledger_on_payout_update` är korrigerat i migrationsfilen

Kvar innan `fixed`:
- applicera `20260719_fix_payout_ledger_enum.sql` i Supabase
- kör `node scripts/verify-package-payout.mjs` och verifiera `signedWebhookCompletedPayout: true`

## Claude Next Scope

Claude får nu jobba inom detta scope utan att riskera huvudlogiken:

1. I [app/profil/page.tsx](C:/Users/djnoc/Gonow/gonow/app/profil/page.tsx)
- städa bara kundsynliga texter
- fixa bara mojibake, labels, underrubriker och hjälprader
- du får städa kommentarer också om du vill, men inte logik
- ändra inte source-of-truth-logik, filtrering eller state-flöden

2. I [app/skicka/page.tsx](C:/Users/djnoc/Gonow/gonow/app/skicka/page.tsx)
- förbered en text-/label-runda som minskar förare/bärare/AI-matchning
- ändra inte API-anrop, query-parametrar eller huvudsteg

Claude ska inte röra:
- auth callback
- package submission logic
- dedupe mellan `packages` och legacy
- meddelandelänkning
- payment state ownership

## Validation Commands

Kör efter varje riktig fixrunda:

```powershell
npx tsc --noEmit
npx next build
```

Vid paket-/profilflöden ska även smoke test göras:

1. kund loggar in
2. kund ser rätt paketstatus
3. förare ser bara sina egna inkommande package-matches
4. accepterad resa fortsätter i samma kedja

## Important

Gör inte detta utan uttryckligt behov:
- nya sidor
- nya tabeller
- nya parallella API-flöden
- redesign av produkten

Föredra alltid:
- bättre integration
- bättre wording
- bättre consistency
- bättre logic

Från och med nu:

**Vi bygger inte fler system. Vi färdigställer Gonow.**
