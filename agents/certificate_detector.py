"""
agents/certificate_detector.py
-------------------------------
Agent 1: Certificate Detection Agent.

Decides whether the uploaded document is actually a certificate by
looking for typical certificate cues in the OCR'd text (institution
name, completion statements, signature/seal mentions, header
patterns, etc).
"""

import json
import re

from langchain_core.prompts import PromptTemplate

from llm import get_llm

DETECTION_PROMPT = PromptTemplate(
    input_variables=["document_text"],
    template="""You are a Certificate Detection Agent.

Your job is to determine whether the document text below comes from
a genuine CERTIFICATE (such as a course completion certificate,
diploma, award, or professional credential).

Look for cues such as:
- Certificate-style layout/header (e.g. "Certificate of Completion",
  "This is to certify that...")
- Institution / organization name
- Candidate / recipient name
- Mentions of a logo, seal, stamp or signature
- Completion or achievement statements
- Certificate ID / serial number / date patterns

Document text:
---
{document_text}
---

Respond with ONLY a valid JSON object, no extra text, in exactly
ONE of these two formats:

If it IS a certificate:
{{"is_certificate": true, "confidence": <integer 0-100>}}

If it is NOT a certificate:
{{"is_certificate": false, "confidence": <integer 0-100>, "message": "Uploaded document does not appear to be a valid certificate."}}
""",
)


class CertificateDetectorAgent:
    """Agent 1: decides if the uploaded document is a certificate."""

    def __init__(self):
        self.llm = get_llm(temperature=0.0)
        self.prompt = DETECTION_PROMPT

    def run(self, text: str) -> dict:
        if not text or not text.strip():
            return {
                "is_certificate": False,
                "confidence": 0,
                "message": "No readable text could be extracted from the document.",
            }

        chain = self.prompt | self.llm
        response = chain.invoke({"document_text": text[:6000]})
        raw_output = response.content.strip()

        result = self._safe_json_parse(raw_output)

        # Guard against malformed LLM output
        if "is_certificate" not in result:
            result = {
                "is_certificate": False,
                "confidence": 0,
                "message": "Uploaded document does not appear to be a valid certificate.",
            }

        return result

    @staticmethod
    def _safe_json_parse(raw_output: str) -> dict:
        """Extracts and parses the first JSON object found in the LLM output."""
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
