FROM python:3.11-slim

WORKDIR /app

# Upgrade pip and install dependencies
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all workflow code, prompts, and middleware
COPY *.py .
COPY prompts/ ./prompts/
COPY workflows/ ./workflows/
COPY services/ ./services/
COPY middleware/ ./middleware/
COPY lib/ ./lib/
COPY tests/ ./tests/

# Expose port
EXPOSE 12322

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:12322/api/health')"

# Run with uvicorn directly (bypasses __main__ block which has reload=True)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "12322"]
