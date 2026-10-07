from pydantic import Field

from app.services.nexon.schemas.common import NexonModel


class NoticeEntry(NexonModel):
    title: str
    url: str
    notice_id: int
    date: str | None = None


class NoticeList(NexonModel):
    notice: list[NoticeEntry] = Field(default_factory=list)


class NoticeDetail(NexonModel):
    title: str
    url: str
    contents: str | None = None
    date: str | None = None


class UpdateNoticeEntry(NexonModel):
    title: str
    url: str
    notice_id: int
    date: str | None = None


class UpdateNoticeList(NexonModel):
    update_notice: list[UpdateNoticeEntry] = Field(default_factory=list)


class UpdateNoticeDetail(NexonModel):
    title: str
    url: str
    contents: str | None = None
    date: str | None = None


class EventNoticeEntry(NexonModel):
    title: str
    url: str
    notice_id: int
    date: str | None = None
    date_event_start: str | None = None
    date_event_end: str | None = None
    thumbnail_url: str | None = None


class EventNoticeList(NexonModel):
    event_notice: list[EventNoticeEntry] = Field(default_factory=list)


class EventNoticeDetail(NexonModel):
    title: str
    url: str
    contents: str | None = None
    date: str | None = None
    date_event_start: str | None = None
    date_event_end: str | None = None


class CashshopNoticeEntry(NexonModel):
    title: str
    url: str
    notice_id: int
    date: str | None = None
    date_sale_start: str | None = None
    date_sale_end: str | None = None
    ongoing_flag: str | None = None
    thumbnail_url: str | None = None


class CashshopNoticeList(NexonModel):
    cashshop_notice: list[CashshopNoticeEntry] = Field(default_factory=list)


class CashshopNoticeDetail(NexonModel):
    title: str
    url: str
    contents: str | None = None
    date: str | None = None
    date_sale_start: str | None = None
    date_sale_end: str | None = None
    ongoing_flag: str | None = None
