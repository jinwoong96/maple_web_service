from pydantic import Field

from app.services.nexon.schemas.common import NexonModel


class OverallRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    character_name: str
    world_name: str
    class_name: str
    sub_class_name: str | None = None
    character_level: int
    character_exp: int | None = None
    character_popularity: int | None = None
    character_guildname: str | None = None


class OverallRanking(NexonModel):
    ranking: list[OverallRankingEntry] = Field(default_factory=list)


class UnionRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    character_name: str
    world_name: str
    class_name: str
    sub_class_name: str | None = None
    union_level: int | None = None
    union_power: int | None = None


class UnionRanking(NexonModel):
    ranking: list[UnionRankingEntry] = Field(default_factory=list)


class GuildRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    guild_name: str
    world_name: str
    guild_level: int
    guild_master_name: str | None = None
    guild_mark: str | None = None
    guild_point: int | None = None


class GuildRanking(NexonModel):
    ranking: list[GuildRankingEntry] = Field(default_factory=list)


class DojangRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    character_name: str
    world_name: str
    class_name: str
    sub_class_name: str | None = None
    character_level: int
    dojang_floor: int | None = None
    dojang_time_record: int | None = None


class DojangRanking(NexonModel):
    ranking: list[DojangRankingEntry] = Field(default_factory=list)


class TheSeedRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    character_name: str
    world_name: str
    class_name: str
    sub_class_name: str | None = None
    character_level: int
    theseed_floor: int | None = None
    theseed_time_record: int | None = None


class TheSeedRanking(NexonModel):
    ranking: list[TheSeedRankingEntry] = Field(default_factory=list)


class AchievementRankingEntry(NexonModel):
    date: str | None = None
    ranking: int
    character_name: str
    world_name: str
    class_name: str
    sub_class_name: str | None = None
    trophy_grade: str | None = None
    trophy_score: int | None = None


class AchievementRanking(NexonModel):
    ranking: list[AchievementRankingEntry] = Field(default_factory=list)
