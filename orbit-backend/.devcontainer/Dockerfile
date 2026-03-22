FROM mcr.microsoft.com/devcontainers/javascript-node:20

ARG CACHEBUST=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl docker.io \
  && rm -rf /var/lib/apt/lists/*

# Debian 13(trixie) の docker.io パッケージには CLI (docker) が同梱されていないため、
# 公式の静的バイナリから CLI のみ導入する。
ARG DOCKER_CLI_VERSION=29.2.1
RUN arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
    amd64) docker_arch="x86_64" ;; \
    arm64) docker_arch="aarch64" ;; \
    *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
  esac \
  && echo "cachebust=${CACHEBUST}" >/dev/null \
  && curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_CLI_VERSION}.tgz" -o /tmp/docker.tgz \
  && tar -xzf /tmp/docker.tgz -C /tmp \
  && mv /tmp/docker/docker /usr/local/bin/docker \
  && chmod +x /usr/local/bin/docker \
  && rm -rf /tmp/docker /tmp/docker.tgz

