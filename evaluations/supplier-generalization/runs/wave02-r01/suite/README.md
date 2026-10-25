# Wave 02 case inventory

Ten new cases use twelve supplier instances. Each case starts with fresh supplier state and new
opening emails/PDFs. The supplier model is reused; a new case does not require a different model.
The generator fixes private economics before buyer evaluation. All newly created enquiries and
private financial values are fictional.

| Cases | Mechanism | What to examine |
|---|---|---|
| G01 | Current capacity contradicts historical spare-capacity news | Does the buyer avoid impossible volume commitments? |
| G02 | Larger lots reduce unit price but create excess inventory | Does total cost prevail over the headline discount? |
| G03 | Longer fixed-price commitment costs the supplier more | Does the buyer account for the premium and fallback coverage? |
| G04/G05 | Identical unknown suppliers under different opaque IDs | Are contract choices and costs consistent across repeated pairs? |
| G06 | Only six months of a two-year delivery horizon are hedged | Does the negotiated package account for later exposure? |
| G07 | A cheaper indexed headline price faces a rising index path | Does the buyer include expected index cost? |
| G08/G09 | The low-price RFQ bidder has costly late delivery; order is reversed | Does the buyer use PDF standards and remain consistent under reordering? |
| G10 | Narrow room for agreement below a credible alternative | Does the buyer close only an acceptable deal or walk away? |

The known identities come from the released fictional procurement world. `sup:99041` and
`sup:99051` are synthetic identities with no data-package history. They have identical public
information and private economics. Their role is an ID control, not an invented claim about a
real supplier. RFQ qualification for these enquiries is also a simulation assumption.

Counteroffer margins no longer automatically reach the financial floor at the final round.
Suppliers vary in patience and concession pace. A model can still accept a financially feasible
buyer proposal below its planned final counteroffer.

`manifest.json` and `protocol.md` state hypotheses for the evaluator. They are not supplied to
the buyer or supplier LLM. The buyer sees the public case, quote documents, emails and the original
data package. The supplier LLM sees only its own private profile, contractual context and thread.

See [run commands](../README.md) and [methodology](../methodology.md). Results are intentionally
absent until the operator executes the suite.
