FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AI_HOST=0.0.0.0 AI_PORT=8000
WORKDIR /srv
RUN useradd --system --uid 10001 --no-create-home ai
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY knowledge ./knowledge
USER ai
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:'+os.environ['AI_PORT']+'/health', timeout=2)"
CMD ["python", "-m", "app"]
