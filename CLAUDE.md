@AGENTS.md

# Gonow – Product Vision (July 2026)

---

## North Star

Every decision should make Gonow feel more like one transport company.

Never expose internal complexity.

Customers should experience:

> "I booked a package.  
> Gonow took responsibility.  
> My package arrived."

Nothing matters more than that.

If a feature, flow, wording choice, or technical decision does not make Gonow feel more like one coherent transport company — it is probably not the right priority right now.

---

## Real Competitive Advantage

Gonow's real competitive advantage is not:
- AI
- dispatcher
- forecast
- fleet
- QR
- tracking

Those are components.

The real advantage is:

**Gonow takes responsibility for the transport.**

That is difficult to copy because it requires the whole system to work together as one operating model, one customer journey, and one brand experience.

---

## Architectural Rule

**Never build isolated features.**

Every new feature must strengthen the existing transport system.

If a new feature creates a separate workflow instead of improving the current one — redesign it.

Gonow is one transport operating system.

When asked "what is Gonow?" the answer is:

> Gonow is an intelligent transport operating system that organizes transport from booking to delivery.

Not: an app. Not: a marketplace. Not: an AI tool.

**Current focus: make existing features coherent, stable and simple — not add new ones.**

---

## Four Questions — Required Before Writing Any Code

Before implementing any new feature, answer all four:

1. **Does this improve the customer journey?**
2. **Does this fit inside One Customer Journey?**
3. **Does this strengthen Gonow Responsibility?**
4. **Does this reuse existing systems instead of creating new ones?**

If the answer is **no** to any of them — stop. Rethink the solution.

---

## Finish First

The platform should feel complete before it becomes bigger.

Always prefer:
- better integration
- better UX
- better performance
- better wording
- better consistency

instead of:
- new pages
- new modules
- duplicate workflows

**A finished product creates more value than a larger product.**

From this point forward: we are not building more systems. We are finishing Gonow.

---

## Three Levels

**1. Customer** — sees only: `Du bokar. Vi levererar.`

**2. Transport Resources** — private drivers, logistics companies, future partners. All are transport resources. Customers never see this layer.

**3. Gonow Intelligent System** — the real product. Plans, analyzes, matches, follows up, continues searching, takes responsibility.

---

## One Customer Journey

Every feature must strengthen the same customer journey.

```
Customer
↓
Books package
↓
Gonow takes responsibility
↓
GIS continuously organizes transport
↓
Package delivered
↓
Customer confirms delivery
```

No feature should interrupt or replace this journey.

Every new module should support it.

If a new idea does not fit anywhere on this journey — it does not belong in the product right now.

---

## One Transport System

**This is the most important rule for all development.**

Marketplace, Tracking, Dispatcher, Forecast, Fleet, Smart Package, Notifications, Driver App, Customer Portal, and Logistics Portal are **not separate products**.

They are **modules of one single transport operating system**.

New features must strengthen the existing system — never create parallel workflows.

Before building anything new, ask:
- Does this improve an existing module?
- Or does it create a new parallel flow?

**Build better, not bigger.**

---

## Purpose

This document defines the product vision, architecture and development direction for Gonow.

All future development should follow this vision.

If existing code conflicts with this vision, adapt the code instead of changing the vision.

---

## What Gonow Is

Gonow is not a courier company.

Gonow is not a marketplace.

Gonow is a **transport platform powered by Gonow Intelligent System**.

The platform connects customers with the most suitable transport resource available.

A transport resource can be:
- a private driver
- a logistics company
- another approved transport provider

Customers never need to know who transports the package.

They simply experience:

> "I booked a package. Gonow handled the rest."

---

## Internal Motto

> **"The customer never manages the transport. Gonow does."**

---

## Customer Promise

The customer-facing website should always communicate:

- Fast delivery
- Easy booking
- Safe transport
- High package quality

The homepage sells the **result**. Never the technology.

Customers buy:
- faster deliveries
- lower waiting times
- live tracking
- insured transport
- package safety
- competitive pricing

Technology always remains in the background.

---

## Gonow Intelligent System

Gonow Intelligent System is the operating system behind every transport.

It continuously analyzes:
- packages
- published trips
- transport capacity
- forecasts
- logistics opportunities
- transport status
- historical demand

**It never performs a single search.**

It continuously evaluates new transport possibilities until the package has been delivered or cancelled.

This continuous optimization is one of Gonow's core competitive advantages.

---

## Transport Resources

### Customer Selected Trip

Drivers may publish trips. Customers may choose an existing trip directly.

```
Package
↓
Driver receives request
↓
Accept / Decline
```

If accepted → Package becomes matched.

If declined → Package returns to the open transport pool. Gonow Intelligent System immediately continues searching.

### Automatic Matching

Customers may also publish a package without selecting a trip.

Gonow Intelligent System searches automatically for the best available transport.

Customers should not have to decide how transport is organized.

### Logistics Network

Logistics companies do not publish trips. Instead Gonow Intelligent System creates Forecasts and Logistics Opportunities.

When enough compatible packages exist, they are grouped into a transport opportunity. Logistics companies may accept the entire transport.

---

## Transport Priority

Gonow Intelligent System follows this priority:

1. Customer-selected driver trip
2. Automatic search among compatible trips
3. Other available transport resources
4. Logistics Opportunity
5. Continue searching until transport is found

The system never stops after one failed match.

---

## Language Rules (CRITICAL)

Never use on customer-facing pages:
- ~~bärare~~ → say "transport" or omit
- ~~privatförare~~ / ~~vanliga människor~~ → never
- ~~P2P-logistik~~ → internal term only
- ~~AI-matchning~~ → say "Gonow Intelligent System"
- ~~marketplace~~ → Gonow is not a marketplace

Driver-facing contexts (`/kor`, `/resor`, `/uppdrag` Förare-tab): "förare" is acceptable.

---

## Homepage Philosophy

The homepage communicates:
- Fast transport
- Safe transport
- Efficient transport
- Package protection
- Insurance
- Live tracking
- Sustainability

Gonow Intelligent System is mentioned **only** as the technology working behind the scenes.

---

## Separate Experiences

**Customer** (`/skicka`, `/uppdrag` Avsändare-tab, `/lift` Passagerare-tab, homepage)
→ Never see internal complexity. One unified Gonow brand.

**Driver** (`/kor`, `/resor`, `/uppdrag` Förare-tab)
→ Trips, package requests, active deliveries, earnings.

**Logistics** (`/forecast`, logistics opportunities, pickup/delivery planner)
→ Separate workflow. Not mixed with driver experience.

---

## Design Philosophy

Prefer improving:
- wording
- logic
- consistency
- user flow

Avoid unnecessary redesigns. Reuse existing components whenever possible.

---

## Development Philosophy

Current priority: **finish before expanding.**

Do not introduce unnecessary:
- pages
- APIs
- tables
- duplicate workflows

Prefer improving existing functionality over creating new features.

---

## Gonow Responsibility

Once a customer books a package, **responsibility shifts from the customer to Gonow**.

From that moment, Gonow Intelligent System continuously plans, analyzes and organizes the transport until delivery is completed.

The customer should never have to:
- search for another transport
- coordinate drivers
- compare transport options
- monitor transport planning
- manage logistics

Gonow takes responsibility for the transport process from booking to delivery.

**Gonow does not sell a driver. Does not sell logistics. Does not sell AI. Does not sell an app.**

**Gonow sells responsibility for the transport.**

---

## Core Principle

Everything in Gonow supports one promise:

The customer books a package.

From that moment, Gonow Intelligent System continuously works in the background to find, organize and optimize the best possible transport until the package has been delivered safely, efficiently and in good condition.

**The customer never manages the transport. Gonow does.**
