# Expert and big-company negotiation tactics: what fits our arena

Research note, Sun 25 Oct, two time-boxed web passes (about 04:10 and 04:50): expert and LLM negotiation
research, then corporate procurement practice. No code changed, no arena calls.
Labels: **[S]** = stated by the source; **[R]** = seen in our repo or runs; **[I]** = my inference, not tested.

**Update (Sun 25 Oct, after the sandbox test):** #1 was tested in the free sandbox and **failed** (flag `ask_breakdown`, off; `docs/decision-log.md` entry "v2.1 test", commit 99159a4). D02 sent a breakdown, but overhead and profit came as one line, so it gave no margin. D01 sent nothing. The extra sentence lowered both scores: D01 0.883 → 0.856, D02 0.534 → 0.524. **Lesson: the supplier bots react to any extra wording.** Test every wording change (#2, #3, #10, #11) on D01 and D02 against the current default (engine v1.9) before shipping it.

## Ranked techniques (best expected gain per hour of work first)

| # | Technique | Entry | Lever | Work | Free test |
|---|---|---|---|---|---|
| ~~1~~ | ~~Ask for the cost breakdown (open-book costing)~~ **tested, failed** | A1 | claims, health price, clause share | done | D01 -0.027, D02 -0.010 |
| 2 | One calibrated question per e-mail, warm and firm tone | A2 | wording | 30-45 min | D01, D02 |
| 3 | Proof-of-cost questions on a price-increase letter | B2 | wording | 20 min | D01 |
| 4 | Concession ceiling = justified increase by cost share | B1 | concession schedule, wording | 1-1.5 h | D01, replay P01 |
| 5 | MESO done right: 2-3 sheets with equal C for us, on one track | A3 | sheet menu | 1-2 h | D01, then P18/P08 |
| 6 | Rank-only feedback in RFQs before citing the rival | B3 | RFQ play | 1 h | D02 |
| 7 | Give-get ledger priced in C (MDO/LAA) | B6 | sheet menu, tactician packet | 1-2 h | offline replay, D01 |
| 8 | Lever playbook per goal (Kraljic, Purchasing Chessboard) | B5 | lever schedule | 1 h | offline replay, D01 |
| 9 | One nibble after a quick `agreed` | A4 | accept rule | 1 h | D01 x3 |
| 10 | Show the arithmetic behind each price | A5 | anchor, wording | 45 min | D01 |
| 11 | Bolstering range in the prose | A6 | wording | 20 min | D01 |
| 12 | Same-scope BAFO for all bidders when time is short | B4 | RFQ play | 1 h | D02, arena-sim rehearsal |
| 13 | Ackerman-style last step: odd price plus a zero-cost extra | A7 | concession schedule | 1 h | D01 |

The corporate pass **confirms** A1 (buyers demand cost breakdowns), A2 (questions), A5 (formula-based
prices) and the earlier #8, now merged into B6. It also confirms what we already do: index clauses as the
answer to a material shock, should-cost targets, health pricing for strategic suppliers, and award on total cost.

## A. Expert and LLM negotiation research (first pass)

**A1. Ask for the cost breakdown.**
- **Source:** `brief/api.md` ("Cost breakdown XLSX: you asked and the supplier is open enough"). Liker & Choi, HBR 2004 ([PDF](https://mycourses.aalto.fi/pluginfile.php/1567427/mod_assign/intro/Liker%20et%20Choi%20-HBR-Deeper%20supplier%20relationships-1.pdf)). [SUPC](https://www.supc.ac.uk/?p=7755): "require suppliers to submit a breakdown of their input costs".
- **Evidence:** [R] across all `runs/`, `cost-breakdown.xlsx` arrived 3 times, all from DEMO-J1 in D02, and never in a hosted case. Delivery schedules arrived 134 times. `writer.py` never asks for a breakdown.
- **Implementation:** add one round-1 sentence asking for the breakdown of `<part>`. Parse its elements (EUR per unit and share) into the packet. The shares give the index-clause `material_share` and the weights for B1. The margin narrows the full-cost estimate behind the health price (P02 at stake: 0.205).
- **Risk:** I rated it low. The XLSX has no fact ID, so its figures go into prose only, never into claims.
- **Sandbox result [R]:** failed. D02 sent the XLSX, but overhead and profit came as one line (3.44 of 16.20). That gives only a lower bound (direct cost 79 % of the price) plus the material share, which the quotes already state. D01 sent nothing. Scores dropped: D01 0.883 → 0.856, D02 0.534 → 0.524. Flag `ask_breakdown` stays off.

**A2. One calibrated question per e-mail, warm and firm tone.**
- **Source:** MIT AI negotiation competition, more than 180,000 agent-to-agent negotiations ([arXiv 2503.06416](https://arxiv.org/abs/2503.06416v3)).
- **Evidence:** [S] warmth went with more points and more value claimed (p<0.001). Questions, gratitude and positive language went with deals and value. Dominance claimed more value inside deals, but long conversations went with impasses. The counterparts were GPT-4o-mini. [S] api.md: "Questions go to the person in charge, who answers as openly as the company is." [R] `writer.py` contains no question mark.
- **Implementation:** end each e-mail with one how/what question tied to the supplier's stated interest, for example "What would you need from us to make €X work on 36 months?" Pass the answer to the tactician as S-labelled text.
- **Risk:** low. Never ask anything that reveals our need date or our alternative.

**A3. MESO done right.**
- **Source:** Leonardelli, Gu, McRuer, Medvec & Galinsky, OBHDP 2019, 6 experiments ([RePEc](https://ideas.repec.org/a/eee/jobhdp/v152y2019icp64-83.html)).
- **Evidence:** [S] multiple equivalent offers gave stronger anchors, better offerer outcomes and more joint gain, because they were read as sincere. [R] D01 rose from 0.902 to 0.920 with `single_sheet` off. In P18, the v1.6b menu got 90 days at the same price. P08 lost when the second sheet switched clause track.
- **Implementation:** send 2-3 sheets within €1 of C for us. Each varies one term the supplier values. Every sheet keeps the clause the supplier demanded. Log which sheet it counters on.
- **Risk:** medium. Code must check that C is truly equal for us.

**A4. One nibble after a quick `agreed`.**
- **Source:** Galinsky, Seiden, Kim & Medvec, PSPB 2002 ([Kellogg](https://www.kellogg.northwestern.edu/faculty/research/detail/2002/the-dissatisfaction-of-having-your-first-offer-accepted-the)).
- **Evidence:** [S] an offer accepted at once was usually too generous. [R] in P05, a supplier agreed at once at €29.61 while the best price was about €26.6. In our auctions, agreed offers stood.
- **Implementation:** for a single supplier that agrees within 2 rounds above our target, send one message with the same terms, a price 1-2 % lower and one new argument. If it holds, accept. Never nibble after `final_offer`, and never below the health price.
- **Risk:** medium-high. In a single-supplier thread the agreed sheet may be withdrawn. Ship only if D01 shows it survives.

**A5. Show the arithmetic behind each price.**
- **Source:** Mason et al., JESP 2013 ([PON](https://www.pon.harvard.edu/daily/dealmaking-daily/forming-first-offers-take-precision-account-nb/)). NegotiationArena ([PMLR](https://proceedings.mlr.press/v235/bianchi24a.html)). Salesforce 2026 ([arXiv 2605.16575](https://www.alphaxiv.org/abs/2605.16575)). EMNLP 2025 ([ACL](https://preview.aclanthology.org/new-sigs/2025.findings-emnlp.1222/)).
- **Evidence:** [S] precise offers drew conciliatory counters and were credited with more knowledge. LLM final prices tracked the first proposal (ρ = 0.716). LLM agreements are "heavily dictated by surface-level opening anchors". Detailed reasoning sways models. [R] our prices are already precise to the cent.
- **Implementation:** write the formula with code-computed figures, each next to its ID.
- **Risk:** low.

**A6. Bolstering range.**
- **Source:** Ames & Mason, JPSP 2015 ([PON](https://www.pon.harvard.edu/daily/negotiation-skills-daily/anchoring-bias-negotiation-get-ahead-range-offer)).
- **Evidence:** [S] a range from the target to a more ambitious figure beat a point offer, with no harm to the relationship.
- **Implementation:** the sheet says €123.90 and the prose says "€121.40-123.90". Never write a figure above the sheet price.
- **Risk:** low.

**A7. Ackerman-style last step.**
- **Source:** Voss, practitioner advice only ([summary](https://www.shortform.com/blog/how-to-bargain/)).
- **Evidence:** [S] practitioner advice, no controlled study.
- **Implementation:** when the budget is spent, send an odd final price plus one €0-in-C term the supplier asked for (effective date, lead time within our need), and say "as far as we can go".
- **Risk:** medium. The code must enforce no further price step after that.

## B. Corporate procurement practice (second pass)

**B1. Concession ceiling = the justified increase by cost share.**
- **Source:** [SUPC](https://www.supc.ac.uk/?p=7755). The price-adjustment formula P = P0·(F + a·M/M0 + b·L/L0) in [BHEL tenders](https://tenders.bhel.com/sites/default/files/PVC_Annexure-2023-08-31-04%3A37%3A37.pdf). [Toyota Times](https://toyotatimes.jp/en/report/financial_results_2022/181.html). [Roland Berger 2022](https://rolandberger.com/en/Insights/Publications/Inflation-turns-up-the-pressure-on-automotive-suppliers.html).
- **Evidence:** this is practice, not experiment. [S] SUPC: treat a request as a cost question, and do not accept a price that gives the supplier "a higher margin than before". [S] Toyota revises prices twice a year, in principle bears excess material cost, and has counted energy since FY2022. [S] Roland Berger: OEMs answered with escalation clauses (steel and copper, increasingly labour and oil), and had "considerable flexibility if their supply is at risk".
- **Implementation:** justified % = Σ share_i × Δidx_i. The shares come from `cost_drivers` (A1 failed: the breakdown lumps overhead and profit, and D01 sends none). The changes come from verified `idx` pairs. In a price-increase case our ceiling is today's price × (1 + justified %). The e-mail shows the formula and cites the biggest driver's pair. [R] `claims.py` cites index falls and uses the weight only for ranking; no ceiling is derived from it.
- **Risk:** [I] if the indices rose, the justified price is above today's. Use it as a cap only, never as the anchor. `cost_drivers` shares are not checkable, so they go into prose only.
- **Test:** D01 (a price increase), offline replay of P01.

**B2. Proof-of-cost questions on a price-increase letter.**
- **Source:** [SUPC](https://www.supc.ac.uk/?p=7755). [Clark Hill](https://www.clarkhill.com/news-events/news/clark-hill-2023-automotive-manufacturing-industry-outlook-supply-chain/).
- **Evidence:** [S] SUPC's questions: what have you done to offset it, which independent index supports it, and how will the price return when costs fall? [S] Clark Hill: the suppliers whose increases succeeded came with detailed financial data.
- **Implementation:** this is A2's question slot for price-increase cases. The third question invites the supplier to offer the symmetric index clause itself. [R] clause offers come up often (17 "Preisgleitklausel" mentions, v1.4).
- **Risk:** low.

**B3. Rank-only feedback before citing the rival.**
- **Source:** Elmaghraby, Katok & Santamaria, MSOM 2012 ([RePEc](https://ideas.repec.org/a/inm/ormsom/v14y2012i1p128-144.html)). [UCY 2024](https://papers.econ.ucy.ac.cy/RePEc/papers/04-2024.pdf).
- **Evidence:** [S] in lab procurement auctions, rank-only feedback gave lower prices than full-price feedback. Rank-only beat showing the lead bid, which discourages bidders who are far behind. [R] rival-quote claims moved suppliers 68 times and failed 54 times.
- **Implementation:** the first auction call says "your package is not the lowest in total cost", with our sheet but no figure and no ID. Cite the leader's offer only if that call does not move the bidder.
- **Risk:** it can cost one round inside the 8-minute wave, and it gives up a verified lever for one move.
- **Test:** D02. P05 is noisy (0.66-0.77).

**B4. Same-scope BAFO when time is short.**
- **Source:** [FTA](https://www.transit.dot.gov/procurement/third-party-procurement/best-and-final-offer). [Simfoni](https://simfoni.com/glossary/best-and-final-offer/).
- **Evidence:** [S] practice guidance only: a BAFO goes to a shortlist, on the same clarified scope, with a common cutoff, and it closes the process.
- **Implementation:** when `seconds_left` is low, send every live bidder that is not at `final_offer` our cheapest-C mix with "please send your best and final offer on this package", then award on C. This replaces sequential auction calls. Fewer rounds also break ties.
- **Risk:** [I] it may give up part of v1.6c's auction gain (P05 +0.03). The word "final" must be true.

**B5. Lever playbook per goal (Kraljic, Purchasing Chessboard).**
- **Source:** [Kearney Purchasing Chessboard](https://www.kearney.com/insights/books/the-purchasing-chessboard/levers): 4 strategies, 16 levers, 64 methods. [Kraljic quadrants](https://artofprocurement.com/learn/the-kraljic-matrix). [Holland & Hart](https://www.hollandhart.com/strategies-for-dealing-with-critical-suppliers-in-distress).
- **Evidence:** [S] leverage items get competitive bidding and volume leverage. Strategic items get partnership. Bottleneck items get secured supply through framework agreements. Routine items get low effort. [S] Holland & Hart: purchase commitments to a distressed supplier "may justify valuable concessions … price concessions, delivery priority", while advance payment "likely will not address the underlying issues". [R] our engine branches on goal for the health price, but the lever order does not depend on goal.

| goal | chessboard strategy | our levers first | avoid |
|---|---|---|---|
| leverage | leverage competition (target pricing, volume bundling) | rival quote or auction, should-cost, longest contract and volume up to need | health concessions |
| routine | manage spend (low effort) | close at target in few rounds | long argument chains [I] |
| quality_first | joint advantage | ppm commitment, chargebacks, `sc`/`qn` claims (moved 15 of 17 times) | low price at high ppm |
| secure_supply | secure supply (frameworks) | contract length, volume, index clause, price held at the health price | squeezing |
| stabilise | cost partnership (open book) | A1, faster payment if it needs cash, clause on its volatile driver | price below the health price |

- **Implementation:** a goal → lever-order dict for the lever schedule and the give list.
- **Risk:** low. Labels come from the case file, not supplier IDs.

**B6. Give-get ledger priced in C (MDO/LAA).** This replaces the first pass's #8.
- **Source:** [ProcureAbility worksheet](https://procureability.com/wp-content/uploads/2017/04/ProcureAbility-The-Art-of-Negotiation-Best-Practices-for-Success.pdf) (MDO, LAA, BATNA). [Richardson get-gives](https://www.richardson.com/blog/how-to-create-effective-negotiation-get-gives). Walmart/Pactum traded payment terms for discounts: 1.5 % saving and +35 days in the pilot, vendor-reported ([PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2023/walmart-finds-75-percent-vendors-prefer-negotiating-with-chatbot/partial/)).
- **Evidence:** [S] "Giving something up without requesting anything in turn encourages [them] to keep pushing." Only trade low cost for high value. [R] the audit values the terms from the supplier side: lead time +4.5 %, a 5 % deadband about 2 %, ppm 1.1 %, and payment exactly at its rate (4.1-9.8 % against our 8 %). [S] Salesforce: stating trades in words alone did not help LLM agreements.
- **Implementation:** per case, build a table of options with ΔC for us (`total_cost`) against value to the supplier (its sheet pairs, else the labelled prior). MDO is our anchor and LAA our ceiling. Each give goes into a sheet only together with a lower price. Turn `measured_rate` on.
- **Risk:** low. Most gives are worth little except lead time and deadband.

## Popular tactics that do not fit our arena

| Tactic | Why not |
|---|---|
| Feigned desperation (NegotiationArena +20 %) | It leaks urgency or "no alternative". Hard rule. |
| Prompt injection (MIT Inject+Voss) | The floor is code-enforced. Manipulation "has consequences", and the jury reads every replay. |
| Bluffed BATNA, fake rival offer | Claims are checked by ID. A bluff comes back `contradicted` and costs trust. |
| López-style squeeze or reopening deals ([backlash](https://www.allaboutlean.com/de/en-volkswagen-supplier-relations-failure/)) | Pushed past `final_offer`, 6 of 6 suppliers walked (v1.2). Strategic cases charge the health gap. |
| Extreme 65 % opening | Suppliers never sell below their floor, and should-cost is within ±5 %. |
| Exploding offers, deadlines, long silences | The clock is ours. It reads as urgency, and 3 timeouts end the thread. |
| Annual price-down demands (OEMs asked up to 5 %/yr, per Roland Berger) | No fact ID backs a productivity claim. [R] price-history claims moved 0 of 26 suppliers. |
| Time-limited surcharge with a sunset or review | No such field exists, and prose does not bind. The binding equivalent is an index clause with a deadband. |
| Demand-side chessboard levers (spec change, design-to-cost, substitution, make-or-buy) | The need is fixed. Engineering variants are "information, not binding terms" (api.md). |
| Supplier development, joint cost workshops (Toyota-style) | They take months. A case is one e-mail thread. |
| Prepayment rescue, supply-chain finance, Skonto programmes | Only `payment_days` ≥ 0 exists, at our 8 %. [S] advance payment is risky (Holland & Hart). See B6. |
| Stating reciprocity in words only | [S] it did not help LLM agreements (Salesforce 2026). |

**Caveats:** the Pactum/Walmart numbers are vendor-reported and vary by source. For the Salesforce, ICLR 2026 and UCY papers, the Purchasing Chessboard and Toyota's internal rules, I read abstracts or secondary summaries only. No source gives a controlled measure of B1, B2, B4 or B5.
