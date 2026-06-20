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
{{"is_certificate": false, "confidence": <integer 0-100>, "reason": "A detailed explanation of why this document is rejected (e.g. 'This document appears to be a mathematics exam paper or syllabus rather than a certificate. It lacks completion declarations, issuing authority seals, or recipient award details.')", "instructions": "Helpful guidelines on what type of certificate the user should upload instead (e.g. 'Please upload a course completion certificate, diploma, degree, or official award letter in clean PDF or image format.')"}}
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
                "reason": "No readable text could be extracted from the document. The file might be blank, blurry, or password-protected.",
                "instructions": "Please ensure you upload a high-quality scan or digital copy of a certificate where text is clear and readable."
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
                "reason": "The system was unable to classify this document format.",
                "instructions": "Please check that you are uploading a valid certificate in PDF, PNG, or JPG format."
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
