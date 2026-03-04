FROM node:20.19.4

# Set the working directory
WORKDIR /opt/webapp
RUN mkdir -p /opt/webapp

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

# Common web app and harvest code
RUN mkdir -p /opt/commons
COPY commons/package.json /opt/commons/package.json
COPY commons/package-lock.json /opt/commons/package-lock.json
RUN cd /opt/commons && npm install --omit=dev
COPY commons/lib /opt/commons/lib
COPY commons/index.js /opt/commons/index.js

RUN cd spa && npm run dist
