"""
server.py
---------
FastAPI server wrapping the CertiChain AI LangGraph agent pipeline.
Exposes a REST API for the Next.js frontend.
"""

import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from ingest import extract_text, extract_qr_data
from graph.workflow import build_graph
from blockchain import register_on_chain

app = FastAPI(
    title="CertiChain AI API",
    description="Multi-agent certificate verification backend running on Monad Testnet & Groq.",
    version="1.0.0"
)

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate the compiled LangGraph workflow
graph = build_graph()


@app.get("/")
@app.get("/api/health")
async def health_check():
    """Simple endpoint to verify backend health."""
    return {
        "status": "healthy",
        "network": "Monad Testnet (Chain ID 10143)",
        "api": "CertiChain AI Agents REST API",
        "contract_address": os.getenv("MONAD_CONTRACT_ADDRESS", "")
    }


@app.post("/api/verify")
async def verify_certificate(file: UploadFile = File(...)):
    """
    Accepts an uploaded certificate file, extracts OCR/QR content,
    and runs the multi-agent LangGraph pipeline to authenticate the document.
    """
    filename = file.filename
    suffix = os.path.splitext(filename)[1]
    
    if suffix.lower() not in [".pdf", ".png", ".jpg", ".jpeg"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Must be PDF, PNG, or JPG."
        )

    # Save to a temporary file for ingestion
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        # Run OCR and QR scanning
        raw_text = extract_text(tmp_path)
        qr_data = extract_qr_data(tmp_path)

        # Run multi-agent LangGraph pipeline
        final_state = graph.invoke(
            {
                "file_path": tmp_path,
                "raw_text": raw_text,
                "qr_data": qr_data,
            }
        )
        
        # Format response
        response_data = {
            "file_name": filename,
            "stopped_early": final_state.get("stopped_early", False),
            "detection_result": final_state.get("detection_result", {}),
            "extracted_data": final_state.get("extracted_data", {}),
            "auth_result": final_state.get("auth_result", {}),
            "explanation": final_state.get("explanation", ""),
        }
        return response_data

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Authentication pipeline failed: {e}")

    finally:
        # Ensure temporary file is cleaned up
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                print(f"Failed to delete temp file {tmp_path}: {e}")


@app.post("/api/register")
async def register_certificate_backend(
    file: UploadFile = File(...),
    recipient_name: str = Form(...),
    institution_name: str = Form(...),
    issue_date: str = Form(...),
    trust_score: int = Form(...),
    verification_link: str = Form(""),
    recipient_wallet: str = Form("")
):
    """
    Registers a verified certificate on the Monad testnet blockchain 
    using the backend's hot wallet private key.
    """
    filename = file.filename
    suffix = os.path.splitext(filename)[1]

    # Save to a temporary file
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save temp file: {e}")

    try:
        # Convert date string to timestamp
        timestamp = int(datetime.utcnow().timestamp())
        if issue_date:
            try:
                dt = datetime.strptime(issue_date, "%Y-%m-%d")
                timestamp = int(dt.timestamp())
            except Exception:
                pass

        # Call blockchain registration
        tx_info = register_on_chain(
            file_path=tmp_path,
            recipient_wallet=recipient_wallet,
            recipient_name=recipient_name,
            institution_name=institution_name,
            issue_date_timestamp=timestamp,
            trust_score=trust_score,
            verification_link=verification_link
        )
        return tx_info
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Blockchain registration failed: {e}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn
    # Run backend server locally on port 8000
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
