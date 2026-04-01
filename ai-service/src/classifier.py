import json
import re
from src.llm import create_llm
from src.prompts import classify_prompt
from src.models import ClassifyRequest, ClassifyResponse

async def classify_ticket(request: ClassifyRequest) -> ClassifyResponse:
    try:
        llm = create_llm(streaming=False)
        chain = classify_prompt | llm

        result = await chain.ainvoke({
            "title": request.title,
            "description": request.description
        })

        content = result.content
        
        # Clean markdown if present
        content = re.sub(r"```json|```", "", content).strip()

        data = json.loads(content)

        return ClassifyResponse(
            priority=data.get("priority", "medium"),
            category=data.get("category", "technical"),
            confidence=float(data.get("confidence", 0.7)),
            reasoning=data.get("reasoning", "Classified by AI")
        )

    except json.JSONDecodeError:
        return ClassifyResponse(
            priority="medium",
            category="technical",
            confidence=0.5,
            reasoning="Could not parse AI response, defaulted to medium priority"
        )
    except Exception as e:
        raise RuntimeError(f"Classification failed: {str(e)}")