# MedCare - Family Health Management System
# Multi-stage build with Node.js + Python + PaddleOCR

# ============================================
# Stage 1: Frontend Build
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy client source
COPY client/ ./

# Build React app
RUN npm run build

# ============================================
# Stage 2: Python + PaddleOCR Setup
# ============================================
FROM python:3.11-slim AS python-base

# Install system dependencies for PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install PaddleOCR and dependencies
RUN pip install --no-cache-dir \
    paddlepaddle==2.6.0 \
    paddleocr==2.7.3

# ============================================
# Stage 3: Final Production Image
# ============================================
FROM node:18-slim

# Install Python runtime from python-base stage
COPY --from=python-base /usr/local/bin/python3 /usr/local/bin/python3
COPY --from=python-base /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=python-base /usr/local/lib/libpython3.11.so /usr/local/lib/

# Install required system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/* \
    && ldconfig

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy server source
COPY server/ ./

# Copy Python OCR worker script
COPY server/services/paddle_ocr_worker.py ./services/

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/client/build ./public

# Create necessary directories
RUN mkdir -p uploads/ocr uploads/reports database

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    PYTHON_CMD=python3 \
    PADDLE_OCR_ENABLED=true

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start server
CMD ["node", "index.js"]
