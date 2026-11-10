FROM node:22-alpine

WORKDIR /opt/cf-reporting

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY bin ./bin
COPY lib ./lib

ENTRYPOINT ["node", "bin/cf-reporting.js"]
CMD ["export", "--zip"]
