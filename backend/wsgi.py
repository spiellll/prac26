"""Gunicorn entry point: gunicorn backend.wsgi:app."""
if __package__:
    from .ritm_api import create_app
else:
    from ritm_api import create_app

app = create_app()
