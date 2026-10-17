from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .api import router, validation_error_handler
from .validation import BatchValidationError


app = FastAPI(
    title="Banking Fraud Analyst Workbench",
    description="A synthetic-data decision-support prototype.",
    version="1.0.0",
)
app.include_router(router)
app.add_exception_handler(BatchValidationError, validation_error_handler)

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    app.mount("/fonts", StaticFiles(directory=DIST / "fonts"), name="fonts")

    @app.get("/")
    def frontend_index() -> FileResponse:
        return FileResponse(DIST / "index.html")
