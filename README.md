# Сервис управления заметками

Учебный REST API для летней практики. Автор: **Афанасьев Афанасий Егорович**, направление «Прикладная математика и информатика», профиль «Искусственный интеллект».

API принимает и возвращает **JSON**. Заметки хранятся в **SQLite** при локальном запуске; через переменную `DATABASE_URL` приложение переключается на **PostgreSQL**. Такой выбор сохраняет понятный JSON-интерфейс и одновременно позволяет отработать SQL, ORM и связи между таблицами.

## Возможности

- CRUD для заметок;
- категории и связь «категория — заметки»;
- полнотекстовый поиск по заголовку и содержанию;
- фильтрация по категории и архивному статусу;
- пагинация;
- статистика по категориям через SQL JOIN/GROUP BY;
- единый формат ошибок JSON;
- pytest, Docker Compose, Gunicorn, nginx и Render Blueprint.
- учебный обработчик логов с сравнением O(n × m) и O(n).

## Быстрый запуск в VS Code

Требуется Python 3.9+ и Git. Откройте папку проекта в VS Code, затем выполните:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
python run.py
```

Проверка: `http://127.0.0.1:5000/api/v1/health`.

VS Code предложит расширения Python, Pylance, Docker и REST Client из `.vscode/extensions.json`. Файл `api.http` позволяет отправлять запросы прямо из редактора. Коллекция Postman находится в `postman/`.

## Примеры API

Создать категорию:

```bash
curl -X POST http://127.0.0.1:5000/api/v1/categories \
  -H 'Content-Type: application/json' \
  -d '{"name":"Учёба"}'
```

Создать заметку:

```bash
curl -X POST http://127.0.0.1:5000/api/v1/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Подготовить отчёт","content":"Описать REST API","category_id":1}'
```

Поиск и пагинация:

```bash
curl 'http://127.0.0.1:5000/api/v1/notes?q=отчёт&page=1&per_page=5'
```

Изменить и удалить:

```bash
curl -X PATCH http://127.0.0.1:5000/api/v1/notes/1 \
  -H 'Content-Type: application/json' -d '{"is_archived":true}'
curl -X DELETE http://127.0.0.1:5000/api/v1/notes/1
```

## Тесты и фиксация зависимостей

```bash
pytest -v --cov=notes_api
pip freeze
```

Зафиксированный результат `pip freeze` уже сохранён в `requirements-lock.txt`.

## Docker и PostgreSQL

```bash
docker compose up --build
```

API будет доступен на `http://127.0.0.1:8000/api/v1/health`. Docker Compose запускает приложение и PostgreSQL, а данные базы сохраняются в именованном томе.

## Структура

```text
notes_api/     приложение, модели и маршруты
tests/         автоматические тесты
docs/          SQL, Git, деплой и презентация
postman/       коллекция запросов
nginx/         конфигурация обратного прокси
log_tools/     обработчик логов и пример входного файла
```

## Мини проект по обработке логов

```bash
python log_tools/process_logs.py log_tools/sample.log
```

Функция `count_naive` использует вложенные циклы и имеет сложность O(n × m). `count_optimized` применяет `Counter`, выполняет один проход и имеет сложность O(n).

Подробные инструкции по деплою находятся в `docs/DEPLOYMENT.md`. Ссылка на демо добавляется после публикации в Render/Railway/VPS.
