"""
graph/state.py
----------------
Shared state schema passed between LangGraph nodes.
"""

from typing import TypedDict, List


class CertificateState(TypedDict, total=False):
    file_path: str          # path to the uploaded document
    raw_text: str            # OCR / extracted text
    qr_data: List[str]       # decoded QR/barcode strings
    detection_result: dict   # Agent 1 output
    extracted_data: dict     # Agent 2 output
    auth_result: dict        # Agent 3 output
    explanation: str         # Agent 4 output (final report)
    stopped_early: bool      # True if detection failed and graph short-circuited
