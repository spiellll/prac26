# Docker для дневника Ритм

Образ собирает прежний React-интерфейс и запускает Python Flask через Gunicorn.

```sh
docker compose up --build -d
docker compose logs -f
```

Сайт: http://127.0.0.1:5174/ . В папке `data/diary.sqlite` остаются прежние записи.
Остановка: `docker compose down`.

Сброс локальной базы с резервной копией (предварительно остановите сервер):

```sh
docker compose down
docker compose run --rm app python scripts/reset-diary.py
```

Введите СБРОСИТЬ для подтверждения. Копия сохраняется в `data/backups`.
Никогда не запускайте сброс на единственной копии без проверки пути.
Для PostgreSQL этот скрипт блокируется.

Публикация в Render и VPS описана в [practice/DEPLOYMENT.md](practice/DEPLOYMENT.md).
