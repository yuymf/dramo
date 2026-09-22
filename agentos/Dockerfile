FROM python:3.11-slim

WORKDIR /app

RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .
COPY prompts/ ./prompts/
COPY workflows/ ./workflows/
COPY lib/ ./lib/

EXPOSE 12322

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:12322/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "12322"]
