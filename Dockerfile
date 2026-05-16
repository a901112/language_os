FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0

WORKDIR /app

COPY server.py ./server.py
COPY coach_api.py ./coach_api.py
COPY server_runtime.py ./server_runtime.py
COPY requirements.txt ./requirements.txt
COPY web ./web

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "server_runtime.py"]
