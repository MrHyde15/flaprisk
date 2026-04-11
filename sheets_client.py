"""
Google Sheets client for writing prediction records.
Uses gspread + service account credentials.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

_client = None
_sheet = None


def _get_sheet():
    global _client, _sheet
    if _sheet is not None:
        return _sheet

    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
    sheets_id = os.environ.get("GOOGLE_SHEETS_ID", "")

    if not creds_json or not sheets_id:
        return None

    if os.path.isfile(creds_json):
        creds = Credentials.from_service_account_file(creds_json, scopes=scopes)
    else:
        creds_info = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_info, scopes=scopes)

    _client = gspread.authorize(creds)
    _sheet = _client.open_by_key(sheets_id).sheet1

    # Ensure header row exists
    existing = _sheet.row_values(1)
    if not existing:
        from config import SHEETS_COLUMNS
        _sheet.append_row(SHEETS_COLUMNS, value_input_option="RAW")

    return _sheet


def append_record(row_data: list) -> bool:
    """Append a single row to the Google Sheet. Returns True on success."""
    try:
        sheet = _get_sheet()
        if sheet is None:
            logger.warning("Google Sheets not configured — record not saved.")
            return False
        sheet.append_row(row_data, value_input_option="USER_ENTERED")
        return True
    except Exception as e:
        logger.error(f"Failed to write to Google Sheets: {e}")
        return False


def is_configured() -> bool:
    """Check if Google Sheets credentials are available."""
    return bool(
        os.environ.get("GOOGLE_CREDENTIALS_JSON")
        and os.environ.get("GOOGLE_SHEETS_ID")
    )
