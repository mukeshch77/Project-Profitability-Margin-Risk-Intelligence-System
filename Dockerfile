FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

CMD ["sh", "-c", "gunicorn backend.app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT"]
