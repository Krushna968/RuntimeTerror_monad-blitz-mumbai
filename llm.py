"""
llm.py
------
Centralized LLM client for CertiChain AI.
Uses Groq's LLaMA 3.3 70B model via langchain_groq.
All agents import `get_llm()` from this file instead of creating
their own ChatGroq instances, so the model/config stays consistent
across the whole project.
"""

import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

# Load environment variables from .env
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError(
        "GROQ_API_KEY not found. Please set it in your .env file."
    )


def get_llm(temperature: float = 0.0):
    """
    Returns a configured ChatGroq LLM instance.

    temperature=0.0 is used by default because certificate
    authentication needs deterministic, consistent answers
    rather than creative ones.
    """
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama-3.3-70b-versatile",
        temperature=temperature,
    )
