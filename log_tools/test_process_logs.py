"""Тесты парсера, агрегирования и CLI; работают с unittest и pytest."""

from contextlib import redirect_stdout
from datetime import timedelta
from io import StringIO
import json
from pathlib import Path
import tempfile
import unittest

from log_tools.process_logs import (
    count_statuses_naive,
    count_statuses_optimized,
    main,
    parse_line,
    read_logs,
    summarize,
)


def line(status=200, size="42", target="/api/v1/entries?page=1"):
    return f'127.0.0.1 - - [01/Jul/2026:10:00:00 +0900] "GET {target} HTTP/1.1" {status} {size}'


class LogParserTests(unittest.TestCase):
    def test_parses_timezone_and_query_path(self):
        entry = parse_line(line())
        self.assertEqual(entry.timestamp.utcoffset(), timedelta(hours=9))
        self.assertEqual(entry.path, "/api/v1/entries")
        self.assertEqual(entry.bytes_sent, 42)

    def test_combined_format_and_missing_size(self):
        entry = parse_line(line(204, "-") + ' "-" "Synthetic client"')
        self.assertEqual(entry.status, 204)
        self.assertEqual(entry.bytes_sent, 0)

    def test_invalid_format_date_or_status_is_rejected(self):
        for invalid in ["garbage", line(999), line().replace("01/Jul", "32/Jul"), line() + " extra"]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                parse_line(invalid)

    def test_blank_lines_skipped_but_invalid_line_number_retained(self):
        entries, bad = read_logs(["\n", line(), "bad\n", line(404)])
        self.assertEqual(len(entries), 2)
        self.assertEqual(bad, [3])


class AggregationTests(unittest.TestCase):
    def test_counts_match_expected_for_mixed_statuses(self):
        entries, bad = read_logs([line(200), line(404), line(200), line(500, "-")])
        expected = {200: 2, 404: 1, 500: 1}
        self.assertEqual(count_statuses_naive(entries), expected)
        self.assertEqual(count_statuses_optimized(entries), expected)
        summary = summarize(entries, bad)
        self.assertEqual(summary["server_errors"], 1)
        self.assertEqual(summary["bytes_sent"], 126)
        self.assertEqual(summary["by_path"], {"/api/v1/entries": 4})

    def test_empty_input(self):
        self.assertEqual(count_statuses_naive([]), {})
        self.assertEqual(count_statuses_optimized([]), {})
        self.assertEqual(summarize([], [2])["requests"], 0)

    def test_sample_has_known_totals(self):
        with Path(__file__).with_name("sample.log").open(encoding="utf-8") as source:
            entries, bad = read_logs(source)
        self.assertEqual(summarize(entries, bad)["by_status"], {
            "200": 5, "201": 1, "204": 1, "400": 1, "404": 1, "500": 1,
        })
        self.assertEqual(bad, [])


class CommandLineTests(unittest.TestCase):
    def test_strict_reports_invalid_lines_as_json_and_exit_code(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "test.log"
            source.write_text(line() + "\nbroken\n", encoding="utf-8")
            output = StringIO()
            with redirect_stdout(output):
                code = main([str(source), "--strict"])
        self.assertEqual(code, 2)
        result = json.loads(output.getvalue())
        self.assertEqual(result["requests"], 1)
        self.assertEqual(result["invalid_line_numbers"], [2])


if __name__ == "__main__":
    unittest.main()
