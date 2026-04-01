import json
from typing import AsyncGenerator
from src.llm import create_llm
from src.prompts import suggest_prompt
from src.models import SuggestRequest

async def stream_suggestion(request: SuggestRequest) -> AsyncGenerator[str, None]:
    try:
        llm = create_llm(streaming=True)
        chain = suggest_prompt | llm

        comments_text = ""
        if request.existing_comments:
            for c in request.existing_comments:
                author = "AI" if c.is_ai_generated else c.author_id[:8]
                comments_text += f"- {author}: {c.content}\n"
        else:
            comments_text = "No previous comments"

        async for chunk in chain.astream({
            "title": request.ticket_title,
            "description": request.ticket_description,
            "category": request.ticket_category or "Not specified",
            "priority": request.ticket_priority or "Not specified",
            "comments": comments_text,
            "tone": request.tone,
        }):
            if chunk.content:
                data = json.dumps({"content": chunk.content, "done": False})
                yield f"data: {data}\n\n"

        # Final done chunk
        yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

    except Exception as e:
        error_chunk = json.dumps({"content": "", "done": True, "error": str(e)})
        yield f"data: {error_chunk}\n\n"