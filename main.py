"""
main.py
---------
Command-line entry point for CertiChain AI.
Run this to process a single certificate file and print the result
without using the Streamlit UI.

Usage:
    uv run main.py path/to/certificate.pdf
"""

import sys
import json

from ingest import extract_text, extract_qr_data
from graph.workflow import build_graph


def process_document(file_path: str) -> dict:
    raw_text = extract_text(file_path)
    qr_data = extract_qr_data(file_path)

    graph = build_graph()
    final_state = graph.invoke(
        {
            "file_path": file_path,
            "raw_text": raw_text,
            "qr_data": qr_data,
        }
    )
    return final_state


def main():
    if len(sys.argv) < 2:
        print("Usage: uv run main.py <path_to_certificate_file>")
        sys.exit(1)

    file_path = sys.argv[1]
    final_state = process_document(file_path)

    print("\n=== AGENT 1: DETECTION ===")
    print(json.dumps(final_state.get("detection_result", {}), indent=2))

    if final_state.get("stopped_early"):
        print("\nDocument was rejected as not a valid certificate. Stopping.")
        return

    print("\n=== AGENT 2: DECOMPOSITION ===")
    print(json.dumps(final_state.get("extracted_data", {}), indent=2))

    print("\n=== AGENT 3: AUTHENTICATION ===")
    print(json.dumps(final_state.get("auth_result", {}), indent=2))

    print("\n=== AGENT 4: FINAL REPORT ===")
    print(final_state.get("explanation", ""))


if __name__ == "__main__":
    main()
