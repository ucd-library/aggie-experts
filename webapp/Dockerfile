FROM node:22

# Set the working directory
WORKDIR /app
RUN mkdir -p /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./
# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY lib ./lib
COPY models ./models
COPY spa ./spa