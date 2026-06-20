# Stage 1: Build the frontend React app
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Create the Python runtime environment
FROM python:3.11-slim
WORKDIR /app

# Copy and install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy static frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend source files
COPY backend ./backend

# Environment setup
ENV PYTHONPATH=/app
ENV PORT=8765
ENV VAULT_PATH=/vault

EXPOSE 8765

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8765"]
