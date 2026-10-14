from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from decimal import Decimal
import re

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')

class ActorInput(Input):
    role: Literal['patient', 'staff']
    actor_id: int = Field(gt=0, le=2147483647, strict=True)

class BookingInput(Input):
    clinic_id: int = Field(gt=0, le=2147483647, strict=True)
    copay_amount: str

    @field_validator('copay_amount')
    @classmethod
    def positive_money(cls, value):
        if not re.fullmatch(r'\d{1,8}(\.\d{1,2})?', value) or Decimal(value) <= 0:
            raise ValueError('INVALID_COPAY')
        return format(Decimal(value), '.2f')

class StatusInput(Input):
    status: Literal['WAITING', 'IN_CONSULTATION', 'DISCHARGED']
    expected_status: Literal['WAITING', 'IN_CONSULTATION', 'DISCHARGED']
