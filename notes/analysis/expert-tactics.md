# Expert and big-company negotiation tactics: what fits our arena

Research note, Sun 25 Oct, about 04:40. Time-boxed web research (about 30 min). No code changed, no arena calls.
Labels: **[S]** = stated by the source; **[R]** = seen in our repo or runs; **[I]** = my inference, not tested.

## Ranked techniques (best expected gain per hour of work first)

| # | Technique | Lever | Work | Free test |
|---|---|---|---|---|
| 1 | Ask for the cost breakdown (open-book costing) | claim choice, health price, clause share | 1-2 h | D02 (DEMO-J1), D01 |
| 2 | One calibrated question per e-mail, warm and firm tone | e-mail wording | 30-45 min | D01, D02 |
| 3 | MESO done right: 2-3 sheets with equal C for us, on one track | sheet menu | 1-2 h | D01, then P18/P08 |
| 4 | One nibble after a quick `agreed` | accept rule | 1 h | D01 x3 |
| 5 | Show the arithmetic behind each price (precise, justified anchor) | anchor, wording | 45 min | D01 |
| 6 | Bolstering range in the prose | wording | 20 min | D01 |
| 7 | Ackerman-style last step: odd price plus a zero-cost extra | concession schedule | 1 h | D01 |
| 8 | "If you…, then we…" trades priced at measured exchange rates | sheet menu, wording | 1-2 h | D01 (rate 9.3 %) |

### 1. Ask for the cost breakdown (open-book costing)
- **Source:** Tacto `brief/api.md` ("Cost breakdown XLSX: you asked and the supplier is open enough"). Toyota and Honda make learning the supplier's cost structure part of the relationship: Liker & Choi, HBR 2004, https://mycourses.aalto.fi/pluginfile.php/1567427/mod_assign/intro/Liker%20et%20Choi%20-HBR-Deeper%20supplier%20relationships-1.pdf . Henke's Working Relations Index: suppliers with good OEM relations "give greater price concessions" ([wardsauto](https://www.wardsauto.com/toyota/toyota-rises-everyone-else-falls-in-oem-supplier-relations-study)).
- **Evidence:** [S] the arena sends the XLSX only on request. [R] across all of `runs/`, `cost-breakdown.xlsx` arrived 3 times, all from DEMO-J1 in D02. It never arrived in a hosted case. `writer.py` never asks for it, and the supplier gets 134 delivery schedules.
- **Implementation:** add one sentence in round 1: "Could you share the cost breakdown for <part>, so we can see what drives the increase?" Parse the elements (EUR per unit and share) into the packet. Its material share sets `index_clause.material_share`. Its margin narrows the full-cost estimate behind the health price (the audit shows our health price was 0.6-2 % too high: P02 at stake 0.205).
- **Risk:** low. The XLSX has no fact ID, so its figures go into prose only, never into claims. A closed supplier says no.

### 2. One calibrated question per e-mail, warm and firm tone
- **Source:** MIT AI negotiation competition, more than 180,000 agent-to-agent negotiations ([arXiv 2503.06416](https://arxiv.org/abs/2503.06416v3), [MIT Sloan](https://mitsloan.mit.edu/ideas-made-to-matter/surprising-power-warmth-ai-negotiations)). Voss's calibrated "how/what" questions (the same paper's Inject+Voss agent).
- **Evidence:** [S] warmth went with better points and more value claimed (p<0.001). Question-asking, gratitude and positive language went with deals and with value. Dominance claimed more value inside deals, but longer conversations went with impasses. The counterparts were GPT-4o-mini, so the transfer to other models is unproven. [S] api.md: "Questions go to the person in charge, who answers as openly as the company is." [R] `writer.py` contains no question mark.
- **Implementation:** the writer ends every e-mail with one question tied to the supplier's stated interest. Examples: "What would you need from us to make €X work on 36 months?" or "Which of these packages fits your plant best?" Feed the answer to the tactician as S-labelled text. Keep the numbers firm: warm words, no price padding.
- **Risk:** low. Never ask anything that reveals our need date or our alternative.

### 3. MESO done right
- **Source:** Leonardelli, Gu, McRuer, Medvec & Galinsky, OBHDP 2019, 6 experiments ([RePEc](https://ideas.repec.org/a/eee/jobhdp/v152y2019icp64-83.html)); [PON summary](https://www.pon.harvard.edu/daily/dealmaking-daily/the-benefits-of-multiple-offers/).
- **Evidence:** [S] MESOs gave stronger anchors and better outcomes for the offerer, because recipients saw them as a more sincere effort. They also gave more joint gain and a more cooperative climate. [R] our ablation: without `single_sheet`, D01 rose from 0.902 to 0.920. In P18, v1.6b's menu got a 90-day package at the same price. P08 lost because the second sheet switched clause track. `single_sheet` is on by default.
- **Implementation:** send 2-3 sheets whose C (for us) is within €1 of each other. Each sheet varies one term the supplier values (payment days, contract length, deadband). Every sheet keeps the clause the supplier demanded (this fixes the P08 failure). Log which sheet it counters on as a preference signal.
- **Risk:** medium. The supplier picks the sheet cheapest for it. That is fine only if C is truly equal for us, so code checks C.

### 4. One nibble after a quick `agreed`
- **Source:** Galinsky, Seiden, Kim & Medvec, PSPB 2002, "The dissatisfaction of having your first offer accepted" ([Kellogg](https://www.kellogg.northwestern.edu/faculty/research/detail/2002/the-dissatisfaction-of-having-your-first-offer-accepted-the)).
- **Evidence:** [S] a first offer accepted at once signals that it was too generous; people feel they could have done better. [R] P05: 70250 "agreed at once" at €29.61 while C_best was about €26.6. In our auctions, agreed offers stood ("Our agreed offer stands") and nobody walked.
- **Implementation:** for a single supplier, when it says `agreed` within 2 rounds of our first offer and above our target, send one more message. Use the same terms, a price 1-2 % lower and one new verified argument. If it holds, accept the agreed sheet. Never nibble after `final_offer`, and never go below the health price.
- **Risk:** medium-high. Single-supplier threads are untested here: the supplier may withdraw the agreed sheet (hard rule c: accept the standing offer only). Ship this only if D01 shows that the agreed sheet survives.

### 5. Show the arithmetic behind each price
- **Source:** Mason, Lee, Wiley & Ames, JESP 2013, "Precise offers are potent anchors" ([PON](https://www.pon.harvard.edu/daily/dealmaking-daily/forming-first-offers-take-precision-account-nb/)). LLM anchoring: NegotiationArena, Bianchi et al., ICML 2024 ([PMLR](https://proceedings.mlr.press/v235/bianchi24a.html)). Rebuttal sycophancy, Findings of EMNLP 2025 ([ACL](https://preview.aclanthology.org/new-sigs/2025.findings-emnlp.1222/)).
- **Evidence:** [S] precise first offers drew more conciliatory counteroffers, and recipients credited the offerer with more knowledge. [S] in NegotiationArena, the final price correlated with the first proposal (Spearman ρ = 0.716). [S] Salesforce, 2026 ([arXiv 2605.16575](https://www.alphaxiv.org/abs/2605.16575)): LLM agreements are "heavily dictated by surface-level opening anchors". [S] models accept a counterargument more readily when it carries detailed reasoning. [R] our prices are already cent-precise.
- **Implementation:** the writer states the formula with code-computed figures, for example "€126.53 × (1 − 0.18 × 4.2 %) = €125.57", each figure next to its ID.
- **Risk:** low, as long as every figure comes from code.

### 6. Bolstering range in the prose
- **Source:** Ames & Mason, JPSP 2015, "Tandem anchoring" ([PON](https://www.pon.harvard.edu/daily/negotiation-skills-daily/anchoring-bias-negotiation-get-ahead-range-offer)).
- **Evidence:** [S] a range from the target to a more ambitious figure got better settlements than a point offer, with no harm to the relationship. A range that backs down from the target did worse.
- **Implementation:** the sheet carries €123.90. The prose says "we see this part at €121.40-123.90". Never write a figure above the sheet price.
- **Risk:** low. [I] An LLM supplier may anchor on the low end. The sheet still binds.

### 7. Ackerman-style last step
- **Source:** Voss, *Never Split the Difference* (practitioner advice, no controlled study; [summary](https://www.shortform.com/blog/how-to-bargain/)).
- **Evidence:** [S] practitioner advice only: decreasing steps (65/85/95/100 %), an odd final number, and a non-monetary extra with the last offer to signal the limit. We already use decreasing steps. [R] tiny steps backfired.
- **Implementation:** when the concession budget is spent, the last sheet carries an odd price plus one term that costs us €0 in C and that the supplier asked for: its effective date, lead time up to our need, or its Incoterm when C does not change. The prose says "this is as far as we can go".
- **Risk:** medium. Calling it "final" and then conceding later costs credibility, so the code must enforce no further price step.

### 8. "If you…, then we…" trades at measured exchange rates
- **Source:** Walmart/Pactum traded payment terms for discounts: a 1.5 % saving and +35 days at 64 % of 89 suppliers in the pilot, later reported as 68 % and 3 % ([PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2023/walmart-finds-75-percent-vendors-prefer-negotiating-with-chatbot/partial/), [Pactum](https://pactum.com/commercial-terms/)). Fisher & Ury, options for mutual gain ([PON](https://www.pon.harvard.edu/daily/dispute-resolution/principled-negotiation-resolve-disagreements)).
- **Evidence:** [S] cash terms are the main tail-spend lever (vendor-reported). [R] our audit: supplier rates range from 4.1 % to 9.8 % against our 8 %, and the cash model is exact for payment days. Suppliers price faster delivery at about +4.5 % and want about 2 % more for a 5 % deadband. `measured_rate` is off.
- **Implementation:** switch `measured_rate` on. When its rate is above 8 %, offer faster payment; when below, slower. Phrase it as a condition: "If you can do €X, we can pay in 30 days."
- **Risk:** low. [I] The gain is small: a 2 pp rate gap over 30 days is about 0.17 % of the price. [S] Salesforce found that only stating reciprocity trades did not improve LLM agreements, so the gain must come from the priced sheet, not the words.

## Popular tactics that do not fit our arena

| Tactic | Why not |
|---|---|
| Feigned desperation (NegotiationArena: +20 % vs GPT-4) | It leaks urgency or "no alternative". Hard rule, and api.md says such signals "have consequences". |
| Prompt injection to extract the bottom line (MIT Inject+Voss) | The supplier's floor is code-enforced. "Attempts to manipulate" have consequences, and the jury reads every replay. |
| Bluffed BATNA, fake rival offer | Claims are checked by ID. A bluff has no ID, and a wrong figure comes back `contradicted` and costs trust. |
| López-style squeeze or reopening deals (GM/VW, [backlash](https://www.allaboutlean.com/de/en-volkswagen-supplier-relations-failure/)) | Pushing past `final_offer`: 6 of 6 walked away (v1.2). Strategic cases charge the supplier-health gap. |
| Extreme 65 % Ackerman opening | Suppliers never sell below their floor. Should-cost is within ±5 %, so the anchor would only burn rounds and patience. |
| Exploding offers or deadlines | Only we close, and the clock is ours (8-min waves), not the supplier's. It reads as urgency. |
| Silence or long pauses as pressure | The supplier's time is free. Our late reply is a timeout, and 3 in a row end the thread. |
| Supply-chain finance, reverse factoring, Skonto programmes | No such term exists. Only `payment_days` carries cash value (see #8). |
| Stating reciprocity rules only in words | [S] this did not improve LLM agreements (Salesforce 2026). Prose does not bind. |

**Already covered by our engine** (no new action): Kraljic-style stance per goal, should-cost and cleansheet arguments, index clauses, the RFQ reverse auction, decreasing concessions.
