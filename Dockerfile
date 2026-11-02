FROM node:24-bookworm-slim AS frontend
WORKDIR /src
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
RUN npm run build:practice

FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 RITM_DB_FILE=/app/data/diary.sqlite
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY backend ./backend
COPY log_tools ./log_tools
COPY scripts/reset-diary.py ./scripts/reset-diary.py
COPY --from=frontend /src/frontend-dist ./frontend-dist
COPY public ./public
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --access-logfile - backend.wsgi:app"]
