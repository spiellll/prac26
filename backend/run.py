"""Local development server. The project root can also run this script."""
import os

from ritm_api import create_app

if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5001")))
