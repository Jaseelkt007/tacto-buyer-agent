"""ProcuDeal signals: real sentences from arena supplier replies."""

from arena_kit.agents.procudeal import signals as sg


def asks(body):
    return sg.read({"body": body}).asks


def traits(body):
    return sg.read({"body": body}).traits


def test_asks_from_real_replies():
    assert asks("Which volume can you commit to?") == {"volume"}
    assert asks("A binding higher volume would help us and can improve the price.") == {"volume"}
    assert asks("Faster payment is welcome; we can reflect it in the price.") == {"payment"}
    assert asks("Like I said before, if you want a lower price, we really need faster payment terms.") == {"payment"}
    assert asks("We can offer a Preisgleitklausel on AS-14404.") == {"clause"}
    assert asks("Which figures is that based on? Please send us the data.") == {"data"}
    assert asks("Thank you for your revised offer and the step you have taken.") == set()


def test_traits_from_real_replies():
    frozen = "Due to the strict freeze on price reductions mandated by our management, we must hold firm."
    assert traits(frozen) == {"price_frozen"}
    hedged = "As to the index change data you cited, that is not our reality: our AS-14404 is covered at fixed prices"
    assert traits(hedged) == {"hedged"}
    assert traits("Without movement from your side we cannot move either.") == {"stuck"}


def test_reply_delay():
    assert sg.read({"body": "", "signals": {"reply_delay_days": 4}}).delay_days == 4
    assert sg.read({"body": ""}).delay_days is None
