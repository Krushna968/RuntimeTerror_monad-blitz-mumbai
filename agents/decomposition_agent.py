"""
agents/decomposition_agent.py
-------------------------------
Agent 2: Certificate Decomposition Agent.

Extracts structured fields out of the certificate's raw OCR text:
institution info, candidate info, metadata (ID, dates, QR/barcode),
and validation components (signature, seal, serial number).
"""

import json
import re

from langchain_core.prompts import PromptTemplate

from llm import get_llm

DECOMPOSITION_PROMPT = PromptTemplate(
    input_variables=["document_text", "qr_data"],
    template="""You are a Certificate Decomposition Agent.

Extract structured information from the certificate text below.
QR/barcode data already decoded from the image (if any) is also
provided separately -- use it to fill "qr_data" and to help cross
check the certificate ID.

Document text:
---
{document_text}
---

Decoded QR/barcode data found on the document (may be empty):
---
{qr_data}
---

Respond with ONLY a valid JSON object in EXACTLY this shape
(use empty string "" for any text field you cannot find, and
false for boolean fields you cannot confirm):

{{
  "institution_name": "",
  "candidate_name": "",
  "certificate_id": "",
  "issue_date": "",
  "expiry_date": "",
  "serial_number": "",
  "qr_data": "",
  "has_signature": false,
  "has_seal": false
}}
""",
)


class CertificateDecompositionAgent:
    """Agent 2: extracts structured fields from the certificate."""

    def __init__(self):
        self.llm = get_llm(temperature=0.0)
        self.prompt = DECOMPOSITION_PROMPT

    def run(self, text: str, qr_data=None) -> dict:
        qr_data = qr_data or []
        qr_string = ", ".join(qr_data)

        chain = self.prompt | self.llm
        response = chain.invoke(
            {"document_text": text[:6000], "qr_data": qr_string}
        )
        raw_output = response.content.strip()

        result = self._safe_json_parse(raw_output)

        # Ensure all expected keys exist even if the LLM omitted some
        defaults = {
            "institution_name": "",
            "candidate_name": "",
            "certificate_id": "",
            "issue_date": "",
            "expiry_date": "",
            "serial_number": "",
            "qr_data": qr_string,
            "has_signature": False,
            "has_seal": False,
        }
        defaults.update(result)

        # Always trust the actually-decoded QR data over the LLM's guess
        if qr_string:
            defaults["qr_data"] = qr_string

        return defaults

    @staticmethod
    def _safe_json_parse(raw_output: str) -> dict:
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
