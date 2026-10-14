"""Run with `python main.py`, similar to the reference repository's small entry point."""
import os
import uvicorn
from app.main import app

if __name__ == '__main__':
    uvicorn.run(app,host=os.getenv('CARECONNECT_HOST','127.0.0.1'),port=8000)
