# UDB CI Docker Image
#
# Minimal image containing udb CLI and simulator daemon for CI testing.
# No cloud dependencies.
#
# Build:
#   docker build -t udb-ci .
#
# Run smoke test:
#   docker run --rm udb-ci node ci/smoke-test.js
#
# Interactive:
#   docker run --rm -it udb-ci /bin/sh

FROM node:20-alpine

LABEL maintainer="UDB Team"
LABEL description="UDB CLI and simulator for CI testing"
LABEL version="0.4.0"

# Install minimal dependencies
RUN apk add --no-cache \
    dumb-init

# Create app directory
WORKDIR /udb

# Copy package files first for better caching
COPY package.json ./
COPY client/package.json ./client/
COPY cli/package.json ./cli/
COPY protocol/package.json ./protocol/

# Install dependencies
RUN npm install --workspaces --production

# Copy source files
COPY client/ ./client/
COPY cli/ ./cli/
COPY protocol/ ./protocol/
COPY daemon/simulator/ ./daemon/simulator/
COPY ci/ ./ci/

# Create udb symlink
RUN ln -s /udb/cli/src/udb.js /usr/local/bin/udb && \
    chmod +x /udb/cli/src/udb.js

# Create non-root user
RUN addgroup -S udb && adduser -S udb -G udb
USER udb

# Create config directory
RUN mkdir -p ~/.udb

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

# Default command: run smoke test
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "ci/smoke-test.js"]
