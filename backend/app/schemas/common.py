from pydantic import BaseModel


class OcidResponse(BaseModel):
    ocid: str


class OguildIdResponse(BaseModel):
    oguild_id: str
