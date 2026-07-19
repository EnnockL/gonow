# Gonow Pilot TODO

> Aktiv gemensam arbetslista finns nu i [SHARED_CHECKLIST.md](C:/Users/djnoc/Gonow/gonow/SHARED_CHECKLIST.md).
>
> Använd den som primär checklista för Codex + Claude.
> Den här filen finns kvar som pilotlåsning och arkitekturkompass.

## Pilot Truth

Pilotversionen får inte återinföra två transportsystem.

Det officiella huvudflödet är:

`active trip -> package created -> targeted package_match -> driver accepts -> payment hold -> pickup -> in transit -> delivered -> customer confirmed -> payout available`

Det betyder:
- `packages` är paketets permanenta identitet
- `package_matches` är matchning, riktad resa och accept/decline
- `orders` och `payments` är finansiella poster kopplade till `package_id`
- `payouts` och `escrow_ledger` är förarens ekonomi
- `booking_requests` är legacy eller migrationsstöd, inte ny huvudresa

## 1. Lock Pilot Scope

Mål för pilot:
- Endast `paket på aktiv resa`
- Endast `Supabase` som sann datakälla
- Endast `Stripe` som betalväg
- Inga mock-fallbacks i produktion
- Ett sammanhängande package-flöde hela vägen

Skjuts till senare:
- Lift som full transaktionstjänst
- Retur som eget komplett flöde
- Swish
- Tvister
- Pushnotiser
- Avancerad AI-dispatch

## 2. Remove Parallel Truths

### `lib/bookings.ts`

Att göra:
- ta bort fallback från `booking_requests` till `orders` i samma användarflöde
- ta bort lokal `lsUpsert` som produktionssanning
- behåll lokal draft endast för formuläråterställning, inte för affärsdata
- låt legacy helpers vara fallback, inte primär kundresa

Klart när:
- samma paket skapas bara en gång
- kunden följer ett `package_id`, inte flera identiteter

### `components/driver/MyTrips.tsx`

Att göra:
- sluta läsa `gonow_my_trips` som huvudkälla
- hämta resor från `trips`
- hämta inkommande paket via `package_matches` kopplade till resans `trip_id`
- använd localStorage endast som kortlivad UI-cache om det verkligen behövs

Klart när:
- en resa som registreras syns direkt i "Mina resor" efter refresh
- samma resa syns lika för alla enheter och webbläsare

### `components/driver/TripRegistration.tsx`

Att göra:
- ta bort demosuccess när databasen inte sparat
- visa tydligt fel om resan inte finns i databasen
- validera bilinfo och kapacitet innan submit

Klart när:
- UI aldrig säger att en resa sparats om den inte finns i databasen

## 3. Lock API Around Package Journey

### `app/api/packages/route.ts`

Att göra:
- lås detta som första officiella steget i kundresan
- skapa `package`
- om kunden valt en aktiv resa: skapa riktad `package_match`
- låt package-resan fungera både för vald resa och framtida GIS-matchning

Klart när:
- kunden bokar alltid ett paket först
- samma `package_id` lever vidare genom hela resan

### `app/api/packages/[id]/offers`

Att göra:
- använd endast för matchnings- och acceptlogik kopplad till paketet
- säkerställ att alla erbjudanden är knutna till samma package identity

### `app/api/orders/route.ts`

Att göra:
- behandla `orders` som kommersiell transaktion kopplad till `package_id`
- hämta aktiv användare från session, inte från klientens `user_id`
- på `GET`: returnera bara ordrar som sessionen får se
- på `POST`: skapa inte ny transportidentitet bredvid package-flödet

Klart när:
- `orders` används för pengar, inte som andra leveransobjekt

### `app/api/messages/route.ts`

Att göra:
- kräv inloggad användare
- sätt `sender_id` från session
- tillåt bara trådar där användaren delar package-/match-/trip-relation
- på `GET`: returnera bara trådar som sessionen får läsa

Klart när:
- ingen användare kan läsa eller skriva någon annans data via URL-parametrar

## 4. Make Booking Linear

### `components/booking/TripBookingModal.tsx`

Att göra:
- behåll nuvarande draft-lagring för formulärdata
- efter login: skicka exakt samma draft till samma `/api/packages`-flöde
- visa tydlig status efter skapad package:
  - `Väntar på svar`
  - `Transport klar, väntar på betalning`
  - `Betalning säkrad hos Gonow`

Klart när:
- kundens formulärdata aldrig tappas vid login
- kund alltid ser nästa steg i samma package-kedja

### `app/api/packages/route.ts`

Att göra:
- om kund väljer specifik resa: skapa `package_match` med `trip_id` och förare från resan
- sätt matchstatus till riktad väntan, inte separat booking-request-objekt

### `app/api/packages/[id]/driver-status`

Att göra:
- håll strikt transitionskedja via package/package_match
- säkerställ att bara rätt part kan utföra rätt steg
  - förare: `paid -> picked_up -> in_transit -> delivered`
  - kund: `delivered -> confirmed`

Klart när:
- statuskedjan inte kan hoppa eller köras av fel användare

## 5. Make Payment Real

### `app/api/orders/[id]/checkout/route.ts`

Att göra:
- ta bort mock-success när Stripe saknas i pilot/prod
- om Stripe inte är konfigurerat: returnera tydligt blockerande fel
- säkerställ att checkout bara kan startas för rätt betalningssteg
- koppla checkout till ordern som hör till paketet

### `app/api/webhooks/stripe/route.ts`

Att göra:
- låt webhook vara enda vägen till betald status
- uppdatera package/payment state först efter verifierad Stripe-betalning
- logga webhookfel tydligt

Klart när:
- inget paket blir betalt utan riktig Stripe-bekräftelse

## 6. Simplify Profile To One Journey

### `app/profil/page.tsx`

Att göra:
- sluta blanda:
  - local bookings
  - remote booking requests
  - orders
  - package matches
  - legacy package flow
- bryt ut lastning per domän:
  - `my-packages`
  - `incoming-package-matches`
  - `active-assignments`
  - `wallet`
- dölj legacy-delar i pilot

Pilot-tabbar:
- `Bokningar`
- `Förfrågningar`
- `Aktiva uppdrag`
- `Saldo`
- `Profil`

Klart när:
- kund ser sina paket och rätt betalsteg
- förare ser sina inkommande package-matches
- förare ser sina aktiva leveranser
- förare ser sitt saldo

## 7. Route The Right Package To The Right Driver

### `app/profil/page.tsx`
### `app/api/trips/route.ts`

Att göra:
- bygg inkommande förarvy enbart från resor där `carrier_id === currentUser.id`
- hämta inkommande paket enbart via `package_matches` på dessa `trip_id`
- räkna kapacitet från accepterade paket på resan
- visa pending separat från accepted

Klart när:
- en förare bara ser paket som tillhör sina egna resor
- två förare aldrig ser samma inkommande förfrågan om den inte faktiskt tillhör båda

## 8. Make Notifications Consistent

### `lib/notify.ts`
### `lib/notifications.ts`
### `supabase/schema.sql`

Att göra:
- synka fältnamn mellan kod och schema
- bestäm ett enda kontrakt
- lägg till minsta pilotnotiser:
  - nytt paket till förare via match
  - accepterad match till kund
  - betalning mottagen
  - leverans på väg
  - levererad
  - payout tillgänglig

Klart när:
- in-app-notiser skapas konsekvent utan schemafel

## 9. Make Wallet Pilot Ready

### `app/profil/page.tsx`
### `supabase/schema.sql`

Att göra:
- visa minst tre saldon:
  - `Pending`
  - `Available`
  - `Paid`
- beräkna från:
  - `orders`
  - `payouts`
  - `ledger`
- koppla varje saldo till paket eller order så att föraren förstår varför pengar ligger där

Klart när:
- föraren kan förstå:
  - vad som tjänats in
  - vad som väntar på bekräftelse
  - vad som är klart för utbetalning

## 10. Migration And Database Control

### `supabase/schema.sql`

Att göra:
- verifiera att alla tabeller som appen använder verkligen finns
- verifiera att alla RPC-funktioner som appen anropar verkligen skapas
- verifiera att `packages`, `package_matches`, `payments`, `escrow_ledger`, `payouts`, `notifications`, `trips` är synkade med appkoden
- behandla `booking_requests` som legacy och migrationsstöd, inte som ny sanning

Klart när:
- en ny miljö kan sättas upp utan manuella mysteriefixar i SQL Editor

## Recommended Build Order

1. `app/api/packages/route.ts`
2. `components/booking/TripBookingModal.tsx`
3. `app/api/orders/route.ts`
4. `app/api/orders/[id]/checkout/route.ts`
5. `app/api/packages/[id]/driver-status`
6. `components/driver/TripRegistration.tsx`
7. `components/driver/MyTrips.tsx`
8. `app/profil/page.tsx`
9. `lib/notify.ts` + `lib/notifications.ts` + `supabase/schema.sql`
10. wallet/payout-vyn i profil

## Definition Of Done For Pilot

Piloten är redo först när detta fungerar utan lokal fallback:

1. förare registrerar resa
2. resan syns för kund
3. kund väljer aktiv resa
4. `package` skapas
5. riktad `package_match` skapas
6. endast rätt förare ser matchen
7. förare accepterar
8. kund ser `Betala nu`
9. Stripe-betalning går igenom
10. paketet blir `paid`
11. förare kan markera `picked_up`, `in_transit`, `delivered`
12. kund kan bekräfta
13. payout blir `available`

## Important

Behåll alla goda pilotkrav:
- Supabase only
- ingen produktion-localStorage som affärssanning
- riktig auth
- Stripe webhook som enda väg till `paid`
- strikt statusägarskap
- konsekventa notifieringar
- pending / available / paid-saldo
- rena migrationer

Men bygg inte tillbaka två kundresor.

**Finish one package journey, not two parallel systems.**
