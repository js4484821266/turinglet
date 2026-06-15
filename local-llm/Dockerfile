FROM python:3.11-bookworm AS cpu

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

COPY local-llm/requirements.txt /app/local-llm/requirements.txt
RUN CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
    pip install --no-cache-dir -r /app/local-llm/requirements.txt

COPY local-llm/server.py /app/local-llm/server.py

EXPOSE 8010
CMD ["python3", "/app/local-llm/server.py"]

FROM nvidia/cuda:12.4.1-devel-ubuntu22.04 AS gpu

WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      build-essential cmake python3 python3-dev python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY local-llm/requirements.txt /app/local-llm/requirements.txt
RUN CMAKE_ARGS="-DGGML_CUDA=ON" FORCE_CMAKE=1 \
    python3 -m pip install --no-cache-dir -r /app/local-llm/requirements.txt

COPY local-llm/server.py /app/local-llm/server.py

EXPOSE 8010
CMD ["python3", "/app/local-llm/server.py"]
