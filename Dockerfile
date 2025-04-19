# Generated by https://smithery.ai. See: https://smithery.ai/docs/config#dockerfile
FROM node:lts-alpine

# Add labels for better maintainability
LABEL maintainer="Nekzus <nekzus@example.com>"
LABEL description="NPM Sentinel MCP Server for package analysis"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json .npmrc ./
RUN npm install --ignore-scripts && \
    npm cache clean --force

# Copy source files
COPY tsconfig.json ./
COPY index.ts ./
COPY llms.txt llms-full.txt ./

# Build the TypeScript project
RUN npm run build && \
    # Cleanup dev dependencies after build
    npm prune --production

# Set non-root user for security
USER node

# Run command - The entrypoint of the MCP server
CMD ["node", "dist/index.js"] 