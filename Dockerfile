# syntax=docker/dockerfile:1

# ─── Stage 1: Chromium + system fonts ─────────────────────────────────────────
# Base is Debian 12 Bookworm — same as distroless/nodejs22-debian12, so shared
# library ABIs match exactly. We copy only the extra libs chromium needs.
FROM debian:bookworm-slim AS chrome

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      chromium-sandbox \
      fonts-liberation \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# ─── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Skip Puppeteer's bundled ~170 MB Chrome; we use the system binary from Stage 1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build && pnpm prune --prod

# ─── Stage 3: Distroless runtime ───────────────────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

# Application
COPY --from=builder --chown=65532:65532 /app/dist               ./dist
COPY --from=builder --chown=65532:65532 /app/node_modules       ./node_modules
COPY --from=builder --chown=65532:65532 /app/package.json       ./
COPY --from=builder --chown=65532:65532 /app/xsd                ./xsd

# Handlebars template — ColombianPdfGenerator loads it via __dirname at runtime,
# which resolves to /app/dist/fiscal/colombia/pdf/
COPY --from=builder --chown=65532:65532 \
     /app/src/fiscal/colombia/pdf/templates \
     ./dist/fiscal/colombia/pdf/templates

# Chromium binary + its internal resource directory
COPY --from=chrome /usr/bin/chromium    /usr/bin/chromium
COPY --from=chrome /usr/lib/chromium    /usr/lib/chromium

# Shared libs chromium needs on top of the distroless base.
# Both images are Debian 12 Bookworm, so package versions are ABI-compatible.
COPY --from=chrome /usr/lib/x86_64-linux-gnu /usr/lib/x86_64-linux-gnu

# Fonts needed for PDF rendering
COPY --from=chrome /usr/share/fonts     /usr/share/fonts

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["/app/dist/main.js"]
