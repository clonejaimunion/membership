"""OCR + free-text parsing utilities for membership form ingestion.

Pure functions — no DB access. Extracted from server.py (Phase B refactor).
"""
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from pypdf import PdfReader
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

logger = logging.getLogger(__name__)


def extract_pdf_text(path: Path) -> str:
    try:
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("PDF text extraction failed: %s", exc)
        return ""


def extract_text_for_document(path: Path, content_type: str) -> str:
    if content_type == "application/pdf" or path.suffix.lower() == ".pdf":
        text = extract_pdf_text(path)
        if text:
            return text
        try:
            pages = convert_from_path(str(path), dpi=220, first_page=1, last_page=3)
            return "\n".join(
                pytesseract.image_to_string(page, lang="ara+eng", config="--psm 6") for page in pages
            ).strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF OCR extraction failed: %s", exc)
            return ""
    if content_type.startswith("image/") or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}:
        try:
            image = Image.open(path)
            return pytesseract.image_to_string(image, lang="ara+eng", config="--psm 6").strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Image OCR extraction failed: %s", exc)
            return ""
    return ""


def first_match(text: str, labels: List[str], fallback_pattern: Optional[str] = None) -> str:
    for label in labels:
        pattern = rf"{label}\s*[:：\-]?\s*([^\n\r]+)"
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip(" :：-")[:160]
    if fallback_pattern:
        match = re.search(fallback_pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()[:160]
    return ""


def date_near_label(text: str, labels: List[str]) -> str:
    date_pattern = r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})"
    for label in labels:
        match = re.search(rf"{label}\s*[:：\-]?\s*(?:في|فى)?\s*{date_pattern}", text or "", flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def parse_membership_fields(text: str, today_ar: str) -> Dict[str, str]:
    """Parse Arabic membership form text. today_ar is the current Arabic-formatted date string."""
    national_id_match = re.search(r"(?:\D|^)(\d{14})(?:\D|$)", text or "")
    birth_date_match = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})", text or "")
    birth_date = date_near_label(text, ["تاريخ الميلاد", "الميلاد"]) or (birth_date_match.group(1) if birth_date_match else "")
    return {
        "governorate": first_match(text, ["المحافظة"]),
        "union_committee": first_match(text, ["اللجنة النقابية", "اللجنه النقابيه"]),
        "membership_number": first_match(text, ["رقم العضوية", "رقم العضويه"], r"عضوية\D+(\d+)"),
        "name": first_match(text, ["الاسم", "اسم العضو"]),
        "national_id": national_id_match.group(1) if national_id_match else "",
        "birth_date": birth_date,
        "subscription_date": date_near_label(text, ["تحريراً في", "تحريرا في", "تحريراً فى", "تحريرا فى", "تحريرًا في", "تاريخ التحرير", "منضم بتاريخ", "منضم في", "منضم فى"]),
        "address_phone": first_match(text, ["محل الاقامة والتليفون", "محل الإقامة والتليفون", "العنوان والتليفون"]),
        "status": "فعال",
        "status_date": today_ar,
        "address": first_match(text, ["العنوان", "محل الاقامة", "محل الإقامة"]),
        "beneficiary_name": first_match(text, ["قيمة الإعانة تسلم إلى", "قيمة الاعانة تسلم الى", "قيمة الإعانة تسلم الى", "قيمة الاعانة تسلم إلى", "تسلم الإعانة إلى", "تسلم الاعانة الى"]),
    }
