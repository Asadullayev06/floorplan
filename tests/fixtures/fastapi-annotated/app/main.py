from fastapi import FastAPI

from app.routers import feedback, notes, offices, things

app = FastAPI()
app.include_router(things.router)
app.include_router(notes.router)
app.include_router(offices.router)
app.include_router(feedback.router)
