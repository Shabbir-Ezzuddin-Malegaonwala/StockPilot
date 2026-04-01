import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from models import ProductAnalysisRequest, ProcurementReportRequest
from agent import analyze_product, stream_procurement_report
from config import PORT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="StockPilot AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: ProductAnalysisRequest) -> dict:
    try:
        result = await analyze_product(request)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-report")
async def generate_report(request: ProcurementReportRequest) -> EventSourceResponse:
    if not request.products:
        raise HTTPException(status_code=400, detail="No products provided")

    async def event_generator():
        try:
            async for chunk in stream_procurement_report(request.products):
                yield {"data": json.dumps(chunk)}
        except Exception as e:
            logger.error(f"Report streaming failed: {e}")
            yield {"data": json.dumps({"content": "", "done": True, "error": str(e)})}

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
