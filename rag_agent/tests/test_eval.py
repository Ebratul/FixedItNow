"""The evaluation set is part of the test suite: every case must hold, offline."""

from evals.run_eval import main


async def test_evaluation_set_passes_with_perfect_security_metrics(capsys):
    assert await main(live=False) == 0
    out = capsys.readouterr().out
    assert "unauthorized-data exposures                       0" in out
    assert "recommendation grounding (ids in eligible set)    32/32 (100%)" in out
