"""FastAPI application entrypoint."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, SessionLocal, engine
from .routers import auth, zones
from .seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(
    title="Route 53 Clone API",
    version="1.0.0",
    description="Backend for the AWS Route 53 console clone (hosted zones and DNS records).",
    lifespan=lifespan,
)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_req: Request, exc: RequestValidationError):
    errs = exc.errors()
    first = errs[0] if errs else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "ValidationError", "message": f"{field}: {first.get('msg', 'Invalid input')}", "errors": [{"loc": e.get("loc"), "msg": e.get("msg")} for e in errs]}},
    )


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(zones.router)
