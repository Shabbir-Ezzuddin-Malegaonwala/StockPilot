from pydantic import BaseModel, Field
from typing import Optional

class ClassifyRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)

class ClassifyResponse(BaseModel):
    priority: str
    category: str
    confidence: float
    reasoning: str

class CommentItem(BaseModel):
    content: str
    author_id: str
    is_ai_generated: bool

class SuggestRequest(BaseModel):
    ticket_title: str
    ticket_description: str
    ticket_category: Optional[str] = None
    ticket_priority: Optional[str] = None
    existing_comments: list[CommentItem] = []
    tone: str = "professional"

class StreamChunk(BaseModel):
    content: str
    done: bool
    error: Optional[str] = None