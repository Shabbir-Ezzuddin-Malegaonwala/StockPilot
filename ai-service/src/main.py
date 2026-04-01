from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from src.models import ClassifyRequest, ClassifyResponse, SuggestRequest
from src.classifier import classify_ticket
from src.suggester import stream_suggestion
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="NexaDesk AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    os.getenv("BACKEND_URL", "http://localhost:3001"),
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexadesk-ai"}

@app.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    try:
        result = await classify_ticket(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/suggest-response")
async def suggest_response(request: SuggestRequest):
    return StreamingResponse(
        stream_suggestion(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )