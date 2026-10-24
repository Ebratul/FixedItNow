"""`python -m app` runs the service with settings from the environment."""

import uvicorn

from app.config import ConfigError, load_settings
from app.main import create_app
from app.obs import configure_logging


def main() -> None:
    configure_logging()
    try:
        settings = load_settings()
    except ConfigError as error:
        raise SystemExit(str(error)) from None
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port, log_level="warning")


if __name__ == "__main__":
    main()
