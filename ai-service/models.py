from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class MovementSummary(BaseModel):
    movement_type: str
    quantity: int
    created_at: str


class ProductAnalysisRequest(BaseModel):
    name: str
    current_stock: int
    reorder_level: int
    category: Optional[str] = None
    recent_movements: list[MovementSummary] = []


class RecommendationType(str, Enum):
    REORDER_URGENT = "reorder_urgent"
    REORDER_SOON = "reorder_soon"
    ADEQUATE = "adequate"
    OVERSTOCKED = "overstocked"


class ProductAnalysisResponse(BaseModel):
    recommendation: RecommendationType
    suggested_order_quantity: int
    reasoning: str
    confidence_score: float = Field(ge=0, le=1)


class ProductForReport(BaseModel):
    name: str
    sku: str
    current_stock: int
    reorder_level: int
    category: Optional[str] = None
    price: float


class ProcurementReportRequest(BaseModel):
    products: list[ProductForReport]
