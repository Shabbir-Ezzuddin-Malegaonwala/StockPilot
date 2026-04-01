from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os

load_dotenv()

def create_llm(streaming: bool = False):
    api_key = os.getenv("GROQ_API_KEY")
    model_name = os.getenv("MODEL_NAME", "llama3-8b-8192")

    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in environment variables")

    return ChatGroq(
        model=model_name,
        api_key=api_key,
        streaming=streaming,
        temperature=0.3,
    )