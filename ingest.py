"""
ingest.py
---------
Handles document ingestion: turning a PDF / image / scanned screenshot
into raw text (via PyMuPDF + pytesseract OCR) and decoding any QR /
barcodes found on the document (via OpenCV, no system 'zbar' dependency
required).
"""

import os
import io
import platform

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import cv2
import numpy as np

# ---------------------------------------------------------------------
# Windows users: pytesseract needs to know where tesseract.exe lives.
# If you installed Tesseract-OCR with the default UB-Mannheim installer
# (https://github.com/UB-Mannheim/tesseract/wiki), this path works out
# of the box. Adjust TESSERACT_PATH below if you installed it elsewhere.
# ---------------------------------------------------------------------
TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if platform.system() == "Windows" and os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


SUPPORTED_IMAGE_EXTS = (".jpg", ".jpeg", ".png")


def _pdf_page_to_image(page, zoom: float = 2.0) -> Image.Image:
    """Render a PyMuPDF page to a PIL Image (used for OCR + QR scanning)."""
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    return Image.open(io.BytesIO(img_bytes))


def extract_text(file_path: str) -> str:
    """
    Extracts raw text from a PDF, scanned PDF, JPG, PNG or screenshot.

    Strategy:
      - PDF: try the embedded text layer first (fast, accurate).
             If a page has no text layer (i.e. it's a scanned image),
             fall back to OCR on that page.
      - Image (jpg/png/screenshot): run OCR directly.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text_chunks = []
        doc = fitz.open(file_path)
        for page in doc:
            page_text = page.get_text().strip()
            if page_text:
                text_chunks.append(page_text)
            else:
                # No embedded text -> scanned page -> OCR it
                image = _pdf_page_to_image(page)
                text_chunks.append(pytesseract.image_to_string(image))
        doc.close()
        return "\n".join(text_chunks).strip()

    elif ext in SUPPORTED_IMAGE_EXTS:
        image = Image.open(file_path)
        return pytesseract.image_to_string(image).strip()

    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported: PDF, JPG, PNG."
        )


def extract_qr_data(file_path: str) -> list:
    """
    Detects and decodes any QR codes present in the document using
    OpenCV's built-in QRCodeDetector (no external system dependency
    like zbar required).

    Returns a list of decoded strings (usually URLs). Empty list if
    no QR code is found.
    """
    ext = os.path.splitext(file_path)[1].lower()
    images = []

    if ext == ".pdf":
        doc = fitz.open(file_path)
        for page in doc:
            images.append(_pdf_page_to_image(page))
        doc.close()
    elif ext in SUPPORTED_IMAGE_EXTS:
        images.append(Image.open(file_path))
    else:
        return []

    detector = cv2.QRCodeDetector()
    results = []

    for pil_image in images:
        cv_image = cv2.cvtColor(np.array(pil_image.convert("RGB")), cv2.COLOR_RGB2BGR)

        # detectAndDecodeMulti handles multiple QR codes in one image
        try:
            retval, decoded_info, points, _ = detector.detectAndDecodeMulti(cv_image)
        except cv2.error:
            retval, decoded_info = False, []

        if retval:
            for info in decoded_info:
                if info:
                    results.append(info)
        else:
            # Fallback: try single QR detection
            data, _, _ = detector.detectAndDecode(cv_image)
            if data:
                results.append(data)

    return results
