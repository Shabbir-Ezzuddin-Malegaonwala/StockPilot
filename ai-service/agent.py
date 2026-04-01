import json
import asyncio
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from config import GROQ_API_KEY
from models import ProductAnalysisRequest, ProductAnalysisResponse, ProductForReport


def create_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        groq_api_key=GROQ_API_KEY,
    )


ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert inventory management analyst. Analyze the product stock level and return a JSON response.

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation, no extra text):
{{"recommendation": "<reorder_urgent|reorder_soon|adequate|overstocked>", "suggested_order_quantity": <integer>, "reasoning": "<detailed explanation with specific numbers>", "confidence_score": <float 0-1>}}

━━━ DECISION RULES ━━━
- If current_stock is 0: recommendation = "reorder_urgent", order enough to reach 2x reorder_level
- If current_stock > 0 AND current_stock < reorder_level: recommendation = "reorder_soon" (or "reorder_urgent" if stock < 25% of reorder_level)
- If current_stock >= reorder_level AND current_stock < reorder_level * 3: recommendation = "adequate"
- If current_stock >= reorder_level * 3: recommendation = "overstocked"

━━━ ORDER QUANTITY LOGIC ━━━
- For urgent/soon: suggest enough to bring stock to 2x reorder_level
- suggested_order_quantity = max(0, (reorder_level * 2) - current_stock)
- For adequate/overstocked: suggested_order_quantity = 0

━━━ REASONING QUALITY ━━━
- Include specific numbers: current stock, reorder level, shortage amount
- Mention recent movement trends if available (selling fast, slow-moving, etc.)
- Keep it to 2-3 sentences maximum"""),
    ("human", """Product: {name}
Category: {category}
Current Stock: {current_stock}
Reorder Level: {reorder_level}
Recent Movements: {recent_movements}

Respond with ONLY the JSON object."""),
])


REPORT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a senior inventory procurement advisor generating a professional procurement recommendation report.

━━━ REPORT STRUCTURE (Follow this EXACTLY) ━━━

## Executive Summary
Provide a brief overview of overall inventory health. State how many products are critical, how many need attention, and overall stock health rating (Healthy / Needs Attention / Critical). Include total number of products analyzed.

## Critical Items — Immediate Reorder Required
List products where current_stock = 0 or current_stock < 25% of reorder_level.
For each product, format as a bullet:
- **[Product Name]** (SKU: [sku]) — Stock: [current] / Reorder Level: [level] — **Suggested Order: [qty] units** — Est. Cost: $[price × qty]

If no critical items, state "No critical items — all products have adequate stock."

## Reorder Soon — Approaching Threshold
List products where current_stock > 0 but current_stock < reorder_level.
Same bullet format as above.

If no items in this category, state "No products approaching reorder threshold."

## Adequate Stock — No Action Needed
Briefly list products with healthy stock levels (current_stock >= reorder_level).
Format as a compact list: Product Name (Stock: X, Level: Y) — one line each.

## Budget Summary
Calculate and present:
- **Total Estimated Procurement Cost**: Sum of all suggested order costs (price × suggested_qty for each critical + soon item)
- **Number of Products Requiring Orders**: Count
- **Highest Priority Order**: The single most urgent item with its cost

## Recommended Action Items
Provide a numbered, prioritized action list:
1. [Most urgent action first]
2. [Next priority]
3. [etc.]

━━━ FORMATTING RULES ━━━
- Use markdown headers (##) for sections
- Use **bold** for product names and key numbers
- Use bullet points (-) for product lists
- Include dollar amounts with $ sign
- Keep reasoning concise and actionable
- Do NOT include any preamble before the first ## header"""),
    ("human", """Here are all active products in the organization's inventory:

{products_data}

Generate the procurement recommendation report now."""),
])


async def analyze_product(request: ProductAnalysisRequest) -> ProductAnalysisResponse:
    llm = create_llm()
    chain = ANALYSIS_PROMPT | llm

    movements_str = "None"
    if request.recent_movements:
        movements_str = ", ".join(
            f"{m.movement_type}: {m.quantity} on {m.created_at}"
            for m in request.recent_movements
        )

    try:
        result = await asyncio.wait_for(
            chain.ainvoke({
                "name": request.name,
                "category": request.category or "Uncategorized",
                "current_stock": request.current_stock,
                "reorder_level": request.reorder_level,
                "recent_movements": movements_str,
            }),
            timeout=30,
        )

        parsed = json.loads(result.content)
        return ProductAnalysisResponse(**parsed)
    except asyncio.TimeoutError:
        raise Exception("LLM request timed out")
    except json.JSONDecodeError:
        # Fallback: generate a rule-based response
        if request.current_stock == 0:
            rec = "reorder_urgent"
        elif request.current_stock < request.reorder_level:
            rec = "reorder_soon"
        elif request.current_stock >= request.reorder_level * 3:
            rec = "overstocked"
        else:
            rec = "adequate"

        suggested = max(0, (request.reorder_level * 2) - request.current_stock)

        return ProductAnalysisResponse(
            recommendation=rec,
            suggested_order_quantity=suggested,
            reasoning=f"Stock at {request.current_stock}, reorder level is {request.reorder_level}.",
            confidence_score=0.7,
        )


async def stream_procurement_report(products: list[ProductForReport]):
    llm = create_llm()
    chain = REPORT_PROMPT | llm

    products_data = "\n".join(
        f"- {p.name} (SKU: {p.sku}): Current Stock={p.current_stock}, Reorder Level={p.reorder_level}, "
        f"Unit Price=${p.price:.2f}, Category={p.category or 'N/A'}, "
        f"Stock Value=${p.price * p.current_stock:.2f}"
        for p in products
    )

    try:
        async for chunk in chain.astream({"products_data": products_data}):
            content = chunk.content if hasattr(chunk, "content") else str(chunk)
            if content:
                yield {"content": content, "done": False}

        yield {"content": "", "done": True}
    except Exception as e:
        yield {"content": "", "done": True, "error": str(e)}
