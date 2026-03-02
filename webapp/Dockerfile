FROM node:20.19.4

# Set the working directory
WORKDIR /app
RUN mkdir -p /app

# Copy package.json and package-lock.json
COPY webapp/package.json webapp/package-lock.json ./

# Install all deps (including devDeps) so postinstall can run, then remove devDeps
# RUN npm ci && npm prune --production
RUN npm ci --include=dev

RUN mkdir -p ./spa/client/public
COPY webapp/spa/client/public/package.json webapp/spa/client/public/package-lock.json ./spa/client/public/
RUN cd ./spa/client/public && npm ci --include=dev

# Copy the rest of the application code
COPY webapp/lib ./lib
COPY webapp/models ./models
COPY webapp/spa ./spa

# Copy harvest for keycloak/elements access
COPY harvest/lib ./harvest/lib

# RUN cd spa && npm run dist
