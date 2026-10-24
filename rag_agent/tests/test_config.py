import pytest

from app.config import ConfigError, load_settings
from tests.support import AI_TOKEN, APP_TOKEN, make_settings

BASE = {"AI_SERVICE_TOKEN": AI_TOKEN, "APP_API_SERVICE_TOKEN": APP_TOKEN, "APP_API_BASE_URL": "http://localhost:4000/api/v1"}


def test_minimal_config_runs_without_a_model():
    s = make_settings()
    assert not s.llm_configured and s.openrouter_model is None  # no model is hard-coded


def test_llm_needs_key_and_model_together():
    with pytest.raises(ConfigError, match="both OPENROUTER_API_KEY and OPENROUTER_MODEL"):
        load_settings({**BASE, "OPENROUTER_API_KEY": "k" * 20})
    s = load_settings({**BASE, "OPENROUTER_API_KEY": "k" * 20, "OPENROUTER_MODEL": "vendor/model"})
    assert s.llm_configured


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"AI_SERVICE_TOKEN": "short"}, "AI_SERVICE_TOKEN must be at least 32"),
        ({"APP_API_SERVICE_TOKEN": AI_TOKEN}, "must be different"),
        ({"APP_API_BASE_URL": "ftp://x"}, "APP_API_BASE_URL"),
        ({"OPENROUTER_BASE_URL": "http://insecure.example"}, "OPENROUTER_BASE_URL"),
        ({"OPENROUTER_RESPONSE_FORMAT": "xml"}, "OPENROUTER_RESPONSE_FORMAT"),
        ({"AI_REQUEST_TIMEOUT_SECONDS": "0"}, "between 1 and 120"),
        ({"AI_RATE_LIMIT_PER_MINUTE": "abc"}, "must be an integer"),
        ({"APP_ENV": "staging"}, "APP_ENV"),
    ],
)
def test_invalid_values_are_rejected(override, message):
    with pytest.raises(ConfigError, match=message):
        load_settings({**BASE, **override})


def test_missing_tokens_are_reported():
    with pytest.raises(ConfigError) as err:
        load_settings({"APP_API_BASE_URL": "http://x"})
    assert "AI_SERVICE_TOKEN is required" in str(err.value) and "APP_API_SERVICE_TOKEN is required" in str(err.value)


def test_error_text_never_contains_secret_values():
    secret = "super-secret-value-" + "z" * 30
    with pytest.raises(ConfigError) as err:
        load_settings({**BASE, "OPENROUTER_API_KEY": secret, "AI_PORT": "0"})
    assert secret not in str(err.value)


def test_secrets_are_masked_in_repr():
    assert AI_TOKEN not in repr(make_settings())


def test_openrouter_url_must_be_https_except_a_loopback_fake_outside_production():
    key = {"OPENROUTER_API_KEY": "k" * 20, "OPENROUTER_MODEL": "m/x"}
    dev = {**BASE, **key, "APP_ENV": "development"}
    assert load_settings({**dev, "OPENROUTER_BASE_URL": "http://127.0.0.1:9999"}).openrouter_base_url == "http://127.0.0.1:9999"
    with pytest.raises(ConfigError, match="OPENROUTER_BASE_URL"):
        load_settings({**dev, "OPENROUTER_BASE_URL": "http://openrouter.example"})
    with pytest.raises(ConfigError, match="OPENROUTER_BASE_URL"):
        load_settings({**BASE, **key, "APP_ENV": "production", "OPENROUTER_BASE_URL": "http://127.0.0.1:9999"})


def test_environment_defaults_to_production():
    assert load_settings(BASE).app_env == "production"
