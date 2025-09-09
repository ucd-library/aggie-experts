FROM node:20.19.4

# Set the working directory
WORKDIR /app
RUN mkdir -p /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install all deps (including devDeps) so postinstall can run, then remove devDeps
# RUN npm ci && npm prune --production
RUN npm ci --include=dev

RUN mkdir -p ./spa/client/public
COPY spa/client/public/package.json ./spa/client/public/package-lock.json ./spa/client/public/
RUN cd ./spa/client/public && npm ci --include=dev

# Copy the rest of the application code
COPY lib ./lib
COPY models ./models
COPY spa ./spa

RUN cd spa && npm run dist
