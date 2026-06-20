"""
app.py
--------
Streamlit frontend for CertiChain AI.
No backend required -- everything runs locally in this script.

Run with:
    uv run streamlit run app.py
"""

import os
import tempfile

import streamlit as st

from ingest import extract_text, extract_qr_data
from graph.workflow import build_graph

st.set_page_config(page_title="CertiChain AI", page_icon="🛡️", layout="centered")

st.title("CertiChain AI")
st.caption("AI-powered, explainable certificate authentication — multi-agent system on Groq.")

uploaded_file = st.file_uploader(
    "Upload a certificate (PDF, JPG, or PNG)",
    type=["pdf", "jpg", "jpeg", "png"],
)

if "graph" not in st.session_state:
    st.session_state.graph = build_graph()

if uploaded_file is not None:
    if st.button("Authenticate Certificate", type="primary"):
        # Save the uploaded file to a temp path so ingest.py can read it
        suffix = os.path.splitext(uploaded_file.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.getvalue())
            tmp_path = tmp.name

        with st.spinner("Reading document (OCR + QR scan)..."):
            raw_text = extract_text(tmp_path)
            qr_data = extract_qr_data(tmp_path)

        with st.spinner("Running multi-agent authentication pipeline..."):
            final_state = st.session_state.graph.invoke(
                {
                    "file_path": tmp_path,
                    "raw_text": raw_text,
                    "qr_data": qr_data,
                }
            )

        os.unlink(tmp_path)

        # ---- Agent 1 output ----
        with st.expander("Agent 1 — Certificate Detection", expanded=True):
            st.json(final_state.get("detection_result", {}))

        if final_state.get("stopped_early"):
            st.error("❌ Uploaded document does not appear to be a valid certificate.")
        else:
            # ---- Agent 2 output ----
            with st.expander("Agent 2 — Certificate Decomposition"):
                st.json(final_state.get("extracted_data", {}))

            # ---- Agent 3 output ----
            with st.expander("Agent 3 — Authentication"):
                st.json(final_state.get("auth_result", {}))

            # ---- Final Report ----
            st.subheader("Final Report")
            report = final_state.get("explanation", "")
            if "FRAUD DETECTED" in report:
                st.error(report)
            else:
                st.success(report)
else:
    st.info("Upload a certificate above to get started.")
