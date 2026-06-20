# CertiChain AI

AI-powered, explainable certificate authentication platform — multi-agent
architecture (LangGraph) running on Groq's LLaMA 3.3 70B, with a local
Streamlit UI. No backend server required.

## Folder structure

```
CertiChain_AI/
├── app.py
├── main.py
├── ingest.py
├── llm.py
├── requirements.txt
├── .env
├── agents/
│   ├── __init__.py
│   ├── certificate_detector.py
│   ├── decomposition_agent.py
│   ├── authentication_agent.py
│   └── explainability_agent.py
└── graph/
    ├── __init__.py
    ├── state.py
    └── workflow.py
```

## 1. Install Tesseract OCR (Windows)

pytesseract is just a Python wrapper — it needs the actual Tesseract
engine installed separately:

1. Download the installer from the UB-Mannheim build:
   https://github.com/UB-Mannheim/tesseract/wiki
2. Install it with default settings (default path:
   `C:\Program Files\Tesseract-OCR\tesseract.exe`).
   `ingest.py` already points to this path automatically.

## 2. Get your API keys

- **GROQ_API_KEY** — free at https://console.groq.com/keys
- **TAVILY_API_KEY** — free at https://app.tavily.com (used by Agent 3
  to do a real web search to verify the institution / certificate ID)

Open `.env` and paste both keys in.

## 3. Set up the environment with uv

```powershell
uv venv
.venv\Scripts\activate
uv pip install -r requirements.txt
```

## 4. Run it

**Streamlit UI (recommended):**
```powershell
uv run streamlit run app.py
```

**Command line (single file, no UI):**
```powershell
uv run main.py path\to\certificate.pdf
```

## How it works

1. **Agent 1 – Certificate Detection**: checks whether the upload is
   actually a certificate.
2. **Agent 2 – Decomposition**: extracts institution, candidate,
   dates, IDs, QR data, signature/seal presence into structured JSON.
3. **Agent 3 – Authentication**: runs a real web search (Tavily) to
   verify the institution/certificate ID, checks QR/date/signature
   validity, and produces a trust score + fraud signals.
4. **Agent 4 – Explainability**: turns everything into a final
   human-readable VERIFIED / FRAUD DETECTED report.

All four steps are wired together as a LangGraph state graph
(`graph/workflow.py`) and shown step-by-step in the Streamlit UI via
expanders.
