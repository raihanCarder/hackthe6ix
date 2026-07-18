# Check-In Champions Spec

## Gameplay

### Two modes
- **World Cup (Global)**  
  Gather hotels from around the world (all unique).

- **Normal / Trip Mode**  
  Specific region chosen by user. Opponents in Trip Mode should be drawn from the same live Stay22 search that populated the user’s pack (from a Trip Pack). That guarantees every card is bookable for the trip and keeps the bracket a true recommendation engine. Use **stratified sampling + seeded seeding + small RNG** so opponents feel varied but the final recommendation remains auditable and tied to live data.

## Format
- **Group + Knockout**
- **16 teams**
- **4 groups of 4**

## Styles
- Individual hotel matchups

## Pack Opening — How it works
- Custom map UI where the user can select a country  
- Can narrow down by selecting a city (from recommended ones or custom)  
- Input trip specifics before opening a Trip Pack: check-in, check-out, adults, children, min/max price per night

## Types of Packs
- **Trip Pack**  
  Based on the user’s trip details; all cards are bookable for the trip; primary conversion funnel.

- **Global Pack**  
  Random hotels from around the world; designed for entertainment and sharing.

## Sampling and Seeding Notes
- **Source pool:** Trip Mode samples opponents from the same Stay22 search used to create the Trip Pack.  
- **Stratified sampling:** ensure representation across price bands, property types, and rating bands.  
- **Seed score:** compute a composite seed score such as `0.5 · VALUE + 0.3 · VIBE + 0.2 · LEGACY` to seed and distribute top contenders across groups.  
- **Session seed:** generate a reproducible session seed like `hash(session_id + timestamp + pack_nonce)` to drive all RNG and make matches auditable.  
- **RNG tuning:** keep RNG variance small in Trip Mode so live data dominates; increase variance in Global Mode for spectacle.  
- **Rehydration:** always rehydrate the Final MVP with a Stay22 lookup before showing the Book CTA and handle unavailability with clear fallbacks.
