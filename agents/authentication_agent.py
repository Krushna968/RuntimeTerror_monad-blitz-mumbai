"""
agents/authentication_agent.py
--------------------------------
Agent 3: Authentication Agent.

Cross-checks the extracted certificate data:
  1. QR validation (was a QR/URL found at all? does it look legit?)
  2. Certificate ID validation (REAL web search for the issuing
     institution's official verification page / portal, via Tavily)
  3. Signature / seal presence checks
  4. Issue/expiry date sanity checks
  5. Institution validation (is it a real, known institution?)
  6. Fraud signal detection

Uses Tavily web search (via langchain_community) for real, live
lookups of verification links instead of relying purely on the
LLM's internal knowledge. Requires TAVILY_API_KEY in .env -- if it's
missing, the agent still runs but skips the live search step and
relies on the extracted data only.
"""

import json
import re
import os

from langchain_core.prompts import PromptTemplate
from langchain_community.tools.tavily_search import TavilySearchResults

from llm import get_llm

AUTH_PROMPT = PromptTemplate(
    input_variables=["extracted_data", "search_results"],
    template="""You are a Certificate Authentication Agent.

Below is the structured data extracted from a certificate, and the
results of a real web search performed to verify the institution
and certificate ID.

Extracted certificate data:
---
{extracted_data}
---

Web search results (for institution / certificate ID verification):
---
{search_results}
---

Analyze the data and search results for:
1. QR validation - is qr_data present and does it look like a
   legitimate verification URL?
2. Certificate ID validation - does the search confirm this
   institution has a real verification portal / process?
3. Signature validation - is has_signature true?
4. Date validation - is issue_date present and plausible
   (not in the future, not malformed)? Is expiry_date (if any)
   after issue_date?
5. Institution validation - does the institution appear to be a
   real, recognizable organization based on the search results?
6. Fraud detection - flag any of: missing logo, missing signature,
   fake/missing QR code, invalid serial number, incorrect layout,
   suspicious formatting, institution not verifiable.

Respond with ONLY a valid JSON object in EXACTLY this shape:

{{
  "trust_score": <integer 0-100>,
  "fraud_signals": ["list", "of", "short fraud signal strings, empty list if none"],
  "verification_link": "best matching official verification URL found, or empty string"
}}
""",
)


class AuthenticationAgent:
    """Agent 3: validates and scores the certificate's authenticity."""

    def __init__(self):
        self.llm = get_llm(temperature=0.0)
        self.prompt = AUTH_PROMPT
        self.search_enabled = bool(os.getenv("TAVILY_API_KEY"))
        if self.search_enabled:
            self.search_tool = TavilySearchResults(max_results=4)

    def run(self, extracted_data: dict) -> dict:
        search_results_text = self._search_for_verification(extracted_data)

        chain = self.prompt | self.llm
        response = chain.invoke(
            {
                "extracted_data": json.dumps(extracted_data, indent=2),
                "search_results": search_results_text,
            }
        )
        raw_output = response.content.strip()
        result = self._safe_json_parse(raw_output)

        defaults = {
            "trust_score": 0,
            "fraud_signals": ["Unable to fully evaluate certificate."],
            "verification_link": "",
        }
        defaults.update(result)
        return defaults

    def _search_for_verification(self, extracted_data: dict) -> str:
        """Runs a real web search for the institution's verification page."""
        institution = extracted_data.get("institution_name", "").strip()
        cert_id = extracted_data.get("certificate_id", "").strip()

        if not self.search_enabled:
            return (
                "Web search unavailable (no TAVILY_API_KEY set in .env). "
                "Evaluate using extracted data only."
            )

        if not institution and not cert_id:
            return "No institution name or certificate ID available to search for."

        query = f"{institution} certificate verification {cert_id}".strip()

        try:
            results = self.search_tool.invoke({"query": query})
            # results is typically a list of dicts with 'url' / 'content'
            formatted = []
            for r in results:
                url = r.get("url", "")
                content = r.get("content", "")[:300]
                formatted.append(f"- {url}: {content}")
            return "\n".join(formatted) if formatted else "No relevant search results found."
        except Exception as e:
            return f"Web search failed: {e}"

    @staticmethod
    def _safe_json_parse(raw_output: str) -> dict:
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
