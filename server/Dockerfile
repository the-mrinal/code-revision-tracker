FROM python:3.11-slim

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .

# Copy research docs (markdown + SVG diagrams) for /research page
COPY thoughts/shared/research/*.md ./research-data/
COPY thoughts/shared/research/diagrams/ ./research-data/diagrams/

EXPOSE 8765

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8765"]
