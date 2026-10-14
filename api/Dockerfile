# Build context is the repository root (see docker-compose.yml) so the image contains
# api/, sql/ and data_generation/ in the same layout as the repository.
FROM python:3.12-slim
WORKDIR /app
COPY api/requirements.txt ./api-requirements.txt
COPY data_generation/requirements.txt ./data-generation-requirements.txt
RUN pip install --no-cache-dir -r api-requirements.txt -r data-generation-requirements.txt
COPY sql/ ./sql/
COPY data_generation/ ./data_generation/
COPY api/ ./api/
WORKDIR /app/api
RUN useradd --uid 10001 --create-home careconnect
USER careconnect
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
