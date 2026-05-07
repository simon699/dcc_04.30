"""SQLAlchemy 模型，与 schema_mysql.sql 一致。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, SmallInteger, String, Text, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class WecomFollowUser(Base):
    __tablename__ = "wecom_follow_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    userid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )


class WecomExternalCustomer(Base):
    __tablename__ = "wecom_external_customer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    external_userid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    corp_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corp_full_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    type: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    gender: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    unionid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    external_profile_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    raw_external_contact_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )


class WecomCustomerFollow(Base):
    __tablename__ = "wecom_customer_follow"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    follow_userid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_userid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    remark: Mapped[str | None] = mapped_column(String(512), nullable=True)
    remark_corp_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    createtime: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    tag_id_json: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    tags_json: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    remark_mobiles_json: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    add_way: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wechat_channels_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    oper_userid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    raw_follow_info_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )


class WecomLead(Base):
    __tablename__ = "wecom_leads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    external_userid: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    intent_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    owner_userid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )


class WecomLeadFollow(Base):
    __tablename__ = "wecom_leads_follow"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    follow_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_follow_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    follow_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
