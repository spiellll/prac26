-- «Ритм»: учебные примеры для SQLite и существующей структуры таблиц.
-- Открыть копию data/diary.sqlite в DBeaver/SQLite. Этот файл при обычном
-- выполнении содержит только SELECT/EXPLAIN. Личные записи не изменяются.
-- profiles.user_id и entries.user_id связаны логически: FK в исходной схеме нет.

-- 1. SELECT: последние действующие записи. JSON хранится в столбце data.
SELECT id, user_id, date, created_at,
       json_extract(data, '$.kind') AS kind,
       json_extract(data, '$.title') AS title
FROM entries
WHERE deleted_at IS NULL
ORDER BY date DESC, created_at DESC
LIMIT 10;

-- 2. Фильтрация по типу и диапазону дат. Даты ISO сортируются как строки.
SELECT id, date, json_extract(data, '$.title') AS title
FROM entries
WHERE deleted_at IS NULL
  AND json_extract(data, '$.kind') = 'workout'
  AND date >= '2026-07-01' AND date < '2026-08-01'
ORDER BY date DESC;

-- 3. Пагинация: вторая страница, по 5 записей; первая имеет OFFSET 0.
SELECT id, date, json_extract(data, '$.kind') AS kind
FROM entries
WHERE deleted_at IS NULL
ORDER BY date DESC, created_at DESC, id DESC
LIMIT 5 OFFSET 5;

-- 4. JOIN нескольких таблиц: каждому профилю — число записей и тренировок.
-- Условие удаления стоит в ON, чтобы сохранить профили без записей.
SELECT p.user_id,
       json_extract(p.data, '$.name') AS profile_name,
       COUNT(e.id) AS entry_count,
       SUM(CASE WHEN json_extract(e.data, '$.kind') = 'workout'
                THEN 1 ELSE 0 END) AS workout_count
FROM profiles AS p
LEFT JOIN entries AS e ON e.user_id = p.user_id AND e.deleted_at IS NULL
GROUP BY p.user_id, p.data
ORDER BY entry_count DESC;

-- 5. GROUP BY: распределение записей по виду.
SELECT json_extract(data, '$.kind') AS kind, COUNT(*) AS count
FROM entries
WHERE deleted_at IS NULL
GROUP BY json_extract(data, '$.kind')
ORDER BY count DESC;

-- 6. JSON-массив упражнений: json_each разворачивает упражнения в строки.
SELECT e.date,
       json_extract(exercise.value, '$.name') AS exercise_name,
       json_array_length(json_extract(exercise.value, '$.sets')) AS set_count
FROM entries AS e,
     json_each(e.data, '$.exercises') AS exercise
WHERE e.deleted_at IS NULL
  AND json_extract(e.data, '$.kind') = 'workout'
ORDER BY e.date DESC;

-- 7. JOIN записей и сообщений через user_id без умножения числа записей:
-- сначала отдельно агрегируем таблицу сообщений.
SELECT p.user_id, COALESCE(m.message_count, 0) AS message_count
FROM profiles AS p
LEFT JOIN (
    SELECT user_id, COUNT(*) AS message_count
    FROM messages
    GROUP BY user_id
) AS m ON m.user_id = p.user_id;

-- 8. План выполнения: индекс idx_entries_user_date помогает выборке владельца.
EXPLAIN QUERY PLAN
SELECT id, date FROM entries
WHERE user_id = 'practice-demo-user' AND deleted_at IS NULL
ORDER BY date DESC;

-- Изменяющие команды ниже полностью закомментированы. При необходимости
-- снимайте комментарии ТОЛЬКО НА УЧЕБНОЙ КОПИИ. Весь пример ограничен
-- зарезервированной тестовой UUID и завершается ROLLBACK.
-- Не заменяйте UUID на идентификатор личной записи.
--
-- BEGIN TRANSACTION;
-- INSERT INTO entries (id, user_id, date, data, created_at, deleted_at)
-- VALUES (
--   '11111111-1111-4111-8111-111111111111',
--   'practice-demo-user',
--   '2026-07-01',
--   '{"id":"11111111-1111-4111-8111-111111111111","date":"2026-07-01","kind":"note","text":"Учебная запись","title":"Практика SQL","exercises":[],"value":null,"cycleIndex":null,"createdAt":"2026-07-01T10:00:00Z"}',
--   '2026-07-01T10:00:00Z',
--   NULL
-- );
-- UPDATE entries
-- SET data = json_set(data, '$.text', 'Изменено в учебной транзакции')
-- WHERE id = '11111111-1111-4111-8111-111111111111'
--   AND user_id = 'practice-demo-user';
-- SELECT id, data FROM entries
-- WHERE id = '11111111-1111-4111-8111-111111111111'
--   AND user_id = 'practice-demo-user';
-- DELETE FROM entries
-- WHERE id = '11111111-1111-4111-8111-111111111111'
--   AND user_id = 'practice-demo-user';
-- ROLLBACK;
