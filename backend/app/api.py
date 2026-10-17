"""Public API for sample download, metadata, and bounded batch scoring."""

from __future__ import annotations

from pathlib import Path
import math

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from .explanations import explain
from .scoring import ROOT, ScoringService
from .validation import BatchValidationError, MAX_BYTES, MAX_ROWS, REQUIRED_COLUMNS, OPTIONAL_COLUMNS, normalize_code, validate_csv


router = APIRouter(prefix="/api")
service = ScoringService()


class ExplainRow(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=200)
    step: int = Field(ge=0)
    merchant: str = Field(max_length=200)
    category: str = Field(max_length=200)
    amount: float = Field(ge=0)

    @field_validator("amount")
    @classmethod
    def finite_amount(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("Amount must be finite")
        return value


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "app_version": "1.0.0", "model_status": "loaded", "model_version": service.manifest["artifact_version"]}


@router.get("/meta")
def meta() -> dict:
    return {
        "schema_version": "banksim-v1",
        "required_columns": list(REQUIRED_COLUMNS),
        "optional_columns": list(OPTIONAL_COLUMNS),
        "max_bytes": MAX_BYTES,
        "max_rows": MAX_ROWS,
        "known_merchants": sorted(service.merchants),
        "known_categories": sorted(service.categories),
        "selected_model": service.manifest["selected_model"],
        "model_version": service.manifest["artifact_version"],
        "default_threshold": service.threshold,
        "score_meaning": "Model ranking score, not a calibrated real-world fraud probability",
    }


@router.get("/template.csv")
def template() -> FileResponse:
    return FileResponse(ROOT / "data" / "template.csv", media_type="text/csv", filename="banksim_template.csv")


@router.get("/demo.csv")
def demo() -> FileResponse:
    return FileResponse(ROOT / "data" / "sample_labeled.csv", media_type="text/csv", filename="banksim_demo.csv")


@router.get("/model-lab")
def model_lab() -> dict:
    return service.model_lab


@router.post("/explain")
def explain_row(payload: ExplainRow) -> dict:
    row = payload.model_dump()
    row["merchant"] = normalize_code(row["merchant"])
    row["category"] = normalize_code(row["category"])
    if row["merchant"] not in service.merchants:
        row["merchant"] = "UNKNOWN"
    if row["category"] not in service.categories:
        row["category"] = "UNKNOWN"
    return explain(service, row)


@router.post("/what-if")
def what_if(payload: ExplainRow) -> dict:
    """Score a hypothetical complete row without persisting or mutating a batch."""
    result = explain_row(payload)
    return {**result, "scenario": "hypothetical", "threshold": service.threshold, "would_alert": result["risk_score"] >= service.threshold}


@router.post("/batches/score")
async def score_batch(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise BatchValidationError("file_type", "Choose a .csv file that follows the BankSim v1 template.", status_code=415)
    contents = await file.read(MAX_BYTES + 1)
    batch = validate_csv(contents, service.merchants, service.categories)
    return service.score(batch.rows, batch.labeled, batch.cleaning)


def validation_error_handler(request: Request, exc: BatchValidationError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message, "details": exc.details})
