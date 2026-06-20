"""
agents/explainability_agent.py
---------------------------------
Agent 4: Explainability Agent.

Turns the detection, extraction and authentication results into a
single human-readable report explaining WHY the certificate was
judged genuine or fraudulent.
"""

import json

from langchain_core.prompts import PromptTemplate

from llm import get_llm

EXPLAIN_PROMPT = PromptTemplate(
    input_variables=["extracted_data", "auth_result"],
    template="""You are an Explainability Agent for a certificate
authentication system. Write a clear, human-readable report based
on the data below.

Extracted certificate data:
---
{extracted_data}
---

Authentication result:
---
{auth_result}
---

Rules:
- If trust_score >= 70 and fraud_signals is empty (or only very minor),
  treat the certificate as VERIFIED.
- Otherwise treat it as FRAUD DETECTED.

If VERIFIED, format the report EXACTLY like this (fill in real values):

Certificate Status: VERIFIED

Institution:
<institution_name>

Issue Date:
<issue_date>

Certificate ID:
<certificate_id>

Verification Link:
<verification_link>

Confidence:
<trust_score>%

Reason:
<one or two sentences explaining why it was judged genuine>

If FRAUD DETECTED, format the report EXACTLY like this:

Certificate Status: FRAUD DETECTED

Reasons:
- <fraud signal 1>
- <fraud signal 2>
(list every item from fraud_signals as a bullet)

Confidence:
<trust_score>%

Recommendation:
Please contact the issuing organization.

Respond with ONLY the report text, nothing else (no JSON, no preamble).
""",
)


class ExplainabilityAgent:
    """Agent 4: generates the final human-readable report."""

    def __init__(self):
        self.llm = get_llm(temperature=0.2)
        self.prompt = EXPLAIN_PROMPT

    def run(self, extracted_data: dict, auth_result: dict) -> str:
        chain = self.prompt | self.llm
        response = chain.invoke(
            {
                "extracted_data": json.dumps(extracted_data, indent=2),
                "auth_result": json.dumps(auth_result, indent=2),
            }
        )
        return response.content.strip()
