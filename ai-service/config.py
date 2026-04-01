import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PORT = int(os.getenv("PORT", "8000"))

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")
