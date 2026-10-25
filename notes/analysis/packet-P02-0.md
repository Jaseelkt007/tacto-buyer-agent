# Packet: P02, supplier e-mail 0 (engine v1.7c)

## CASE
[A] case:P02 · price_increase · goal stabilise · parts part:350011 · need 6,110/yr · horizon 1 yr · today's price €348.32
[A] Score: the lower our total cost C, the better. C_open (the best opening quote) = €2,282,867. No deal = our alternative (quote:7200002: €421.06, 30 d payment, lead 56 d), C = €2,604,228.
[A] Our cost of money 8 %/yr; reference payment 60 d; lead time we need 36 d; must-haves: none.
[A] Relationship charge: C rises €31,920 per margin point (per year) the deal leaves it below 0.5 % margin (quadratic over the first 5 points). So the cheapest deal for us is not the lowest price: each option shows its health price, where our C is lowest.
[A] An index clause costs us the expected index move beyond its deadband (CU-NOTATION +5 %) plus index risk 4 %, on its material share.
[A] Negotiable: unit_price, payment_days {pay 14 d, pay 30 d, pay 45 d, pay 60 d, pay 90 d}; index_clause {no clause, clause CU-NOTATION 20 % db 0 %, clause CU-NOTATION 20 % db 3 %, clause CU-NOTATION 20 % db 5 %}. Fixed: lead_time_days 35, volume_per_year 6110, contract_months 12, effective_date 2027-01-01, incoterm DAP, tooling_eur 0.

## SUPPLIER
[D] Antriebstechnik Nordmark AG (sup:70510), DE, owner type group; contract ctr:4600070510.
[E] Its full cost: estimate €369.11/unit, range €356.20-€369.11. Source: should-cost of its plant (cost:350011), capped by its opening quote at the sustainable margin (an assumption: it held in every practice case we could check); the data's should-cost carries about ±5 %.
[E] Its cost of money: unknown until two of its sheets differ only in payment days. The prices below assume 5.0 %/yr (our owner-type guess, which missed by up to 3 points in practice).
[E] Its value of an index clause on CU-NOTATION: the protection beyond the deadband on the exposure it states (20 % of its cost, +47.7 %): db 0 % = 9.5 %, db 3 % = 8.9 %, db 5 % = 8.5 % of the price. Method checked against suppliers' own deadband pricing (12 sheet pairs in two practice cases: within 0.4 points).
[Z] Need: material_risk_protection (strong): Recover the copper cost rise, which is real and at a 36-month peak; it may prefer a copper index clause. (idx:CU-NOTATION@2026-09, doc:20260914-70510-P02, cost:350011)
[Z] Need: volume (moderate): Growth and binding volume on its parts, plus a share of 350013 (and 350012) where it holds no quota. (fc:350011@2026-09, fc:350010@2026-09, fc:350013@2026-09, quote:7100049)
[Z] Need: planning_security (moderate): A longer commitment and timely call-offs around its shutdown. (ctr:4600070510#8.1, doc:20251019-70510-N)
[Z] Need: cash (weak): Faster payment has only modest value: it is financially sound with no cash stress. (sup:70510, ctr:4600070510#4.1)
[Z] Constraint: approval_needed: Changes above its key account manager's band need pricing committee approval, which takes fortnightly cycles. (doc:20260227-70510-M2, doc:20260410-70510-M1)
[Z] Constraint: single_source: Sole supplier for 350011; the qualified alternative quoted far higher. (quote:7200002, rfq:6000000202)
[Z] Constraint: contract_binding: Prices are fixed per calendar year. Its 350011 notice was valid, and the framework auto-renews unless we give notice in time. (ctr:4600070510#3.1, ctr:4600070510#8.1, doc:20260914-70510-P02)

## THREAD
[S] Its quote (status open): offer:70510-0: €370.96, pay 30 d, no clause → our C €2,282,867
[S] It states: CU-NOTATION rose 47.7 % in twelve months and is 20 % of its cost; LCI-C rose 2.7 % in twelve months and is 20 % of its cost; PPI-C241 rose 6.5 % in twelve months and is 14 % of its cost.
[S] Its latest e-mail (~ = a stock line the arena's bots write to everyone): Dear Sir or Madam, ~ Thank you for your enquiry. ~ Please find our Angebot below. We offer a price of €370.96 per unit, Zahlungsziel 30 days net, no Preisgleitklausel. Regarding our cost structure, CU-NOTATION rose 47.7 % in twelve months and is 20 % of our cost. Furthermore, LCI-C rose 2.7 % in twelve months and is 20 % of our cost. Additionally, PPI-C241 rose 6.5 % in twelve months and is 14 % of our cost. ~ Please note that this offer remains valid for 30 days. Mit freundlichen Grüßen Petra Lechner Key Account Manager, Antriebstechnik Nordmark AG

## ARGUMENTS WE MAY CITE (figures checked by code; the arena checks at most 3 per message)
a1 [D, volume_change] Our demand forecast for this part has risen 11.9% (fc:350011@2026-09).  (E0 cites it)
a2 [D, order_history] Our last 3 orders for this part were at EUR 348.32 per unit (po:4500014474-10, po:4500014413-10, po:4500014350-20).  (E0 cites it)
Its side of the facts (D, checkable, support its position - do not cite them):
  - [notice_period] Your letter gives 109 days' notice (doc:20260914-70510-P02), and our framework agreement requires 90 days (ctr:4600070510#3.1).
  - [index_change] Labour cost index DE, manufacturing, seasonally and calendar adjusted changed +2.7% from 2025-06 to 2026-06 (idx:LCI-C@2025-06, idx:LCI-C@2026-06).
  - [index_change] Copper notation for cables and motors changed +47.7% from 2025-09 to 2026-09 (idx:CU-NOTATION@2025-09, idx:CU-NOTATION@2026-09).
  - [index_change] Producer prices DE: basic iron and steel, ferro-alloys changed +6.5% from 2025-08 to 2026-08 (idx:PPI-C241@2025-08, idx:PPI-C241@2026-08).
  - [index_change] Producer prices DE: basic iron and steel, ferro-alloys changed +7.8% from 2025-12 to 2026-08 (idx:PPI-C241@2025-12, idx:PPI-C241@2026-08).
  - [should_cost] Our bottom-up cost model puts the full cost of this part at EUR 374.95 per unit (cost:350011).

## OPTIONS (code-priced; every price is on that option's terms)
E0 the rule engine's move (rules tuned on practice cases - a default, not a fact): €348.32, pay 90 d, no clause → our C €2,270,342 (€12,525 below C_open).
o1 pay 90 d, no clause: health €361.91 → our C €2,233,467, to it -3.3 % vs its own sheet | midway €368.00 → our C €2,243,314, to it -1.6 % vs its own sheet | its_level €374.08 → our C €2,271,583, to it +0.0 % vs its own sheet; health price range €349.63-€361.91 over its full-cost range
o2 pay 60 d, no clause: health €360.37 → our C €2,238,957, to it -3.3 % vs its own sheet | midway €366.44 → our C €2,248,831, to it -1.6 % vs its own sheet | its_level €372.51 → our C €2,277,228, to it -0.0 % vs its own sheet; health price range €348.14-€360.37 over its full-cost range
o3 pay 45 d, no clause: health €359.60 → our C €2,241,684, to it -3.3 % vs its own sheet | midway €365.67 → our C €2,251,588, to it -1.6 % vs its own sheet | its_level €371.73 → our C €2,280,033, to it -0.0 % vs its own sheet; health price range €347.40-€359.60 over its full-cost range
o4 pay 30 d, no clause: health €358.84 → our C €2,244,400, to it -3.3 % vs its own sheet | midway €364.90 → our C €2,254,324, to it -1.6 % vs its own sheet; health price range €346.66-€358.84 over its full-cost range
o5 pay 14 d, no clause: health €358.03 → our C €2,247,284, to it -3.3 % vs its own sheet | midway €364.08 → our C €2,257,222, to it -1.6 % vs its own sheet; health price range €345.88-€358.03 over its full-cost range
o6 pay 90 d, clause CU-NOTATION 20 % db 5 %: health €361.82 → our C €2,251,155, to it +5.0 % vs its own sheet; the clause costs us €17,686 over the horizon; health price range €349.54-€361.82 over its full-cost range
o7 pay 90 d, clause CU-NOTATION 20 % db 0 %: health €361.71 → our C €2,273,259, to it +5.9 % vs its own sheet; the clause costs us €39,781 over the horizon; health price range €349.44-€361.71 over its full-cost range
o8 pay 90 d, clause CU-NOTATION 20 % db 3 %: health €361.77 → our C €2,259,998, to it +5.4 % vs its own sheet; the clause costs us €26,525 over the horizon; health price range €349.50-€361.77 over its full-cost range
(health = where our C is lowest on those terms. its_level = the price worth as much to it as its standing sheet: its cash value plus, for a clause, the protection on the exposure it states [E]. 'to it' = how much more (+) or less (-) a sheet is worth to it than its own standing sheet [E]; contract length or lead time it may value are not counted.)

## ACCEPT
No standing sheet passes the accept check.

## STATE
Its status: open. Messages we may still send: 10.
