-- Для PostgreSQL / DBeaver. В отличие от SQLite здесь используется JSONB.
-- Все запросы ниже только читают данные.
SELECT id, date, data::jsonb ->> 'kind' AS kind,
       data::jsonb ->> 'title' AS title
FROM entries
WHERE deleted_at IS NULL
ORDER BY date DESC, created_at DESC LIMIT 10;

SELECT p.user_id, p.data::jsonb ->> 'name' AS name,
       count(e.id) AS entry_count
FROM profiles p
LEFT JOIN entries e ON e.user_id = p.user_id AND e.deleted_at IS NULL
GROUP BY p.user_id, p.data;

SELECT id, date FROM entries
WHERE deleted_at IS NULL AND data::jsonb ->> 'kind' = 'workout'
ORDER BY date DESC, created_at DESC, id
LIMIT 5 OFFSET 5;
