"""ORM mappings deliberately preserve the existing Node.js SQLite schema.

JSON is stored as text for compatibility with all previously saved diaries.
Relationships declare user_id joins without requiring a destructive migration.
"""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import foreign

db = SQLAlchemy()


class Profile(db.Model):
    __tablename__ = "profiles"

    user_id = db.Column(db.Text, primary_key=True)
    data = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.Text, nullable=False)
    entries = db.relationship(
        "EntryRecord", primaryjoin=lambda: Profile.user_id == foreign(EntryRecord.user_id),
        viewonly=True, lazy="select",
    )
    messages = db.relationship(
        "MessageRecord", primaryjoin=lambda: Profile.user_id == foreign(MessageRecord.user_id),
        viewonly=True, lazy="select",
    )


class EntryRecord(db.Model):
    __tablename__ = "entries"
    __table_args__ = (db.Index("idx_entries_user_date", "user_id", "date"),)

    id = db.Column(db.Text, primary_key=True)
    user_id = db.Column(db.Text, nullable=False)
    date = db.Column(db.Text, nullable=False)
    data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.Text, nullable=False)
    deleted_at = db.Column(db.Text)
    profile = db.relationship(
        "Profile", primaryjoin=lambda: foreign(EntryRecord.user_id) == Profile.user_id,
        viewonly=True, uselist=False,
    )


class MessageRecord(db.Model):
    __tablename__ = "messages"
    __table_args__ = (db.Index("idx_messages_user_created", "user_id", "created_at"),)

    id = db.Column(db.Text, primary_key=True)
    user_id = db.Column(db.Text, nullable=False)
    role = db.Column(db.Text, nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.Text, nullable=False)


class AdviceRecord(db.Model):
    __tablename__ = "advice"

    user_id = db.Column(db.Text, primary_key=True)
    data = db.Column(db.Text, nullable=False)
