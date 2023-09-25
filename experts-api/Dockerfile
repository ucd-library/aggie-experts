ARG FIN_ORG
ARG FIN_TAG

FROM ${FIN_ORG}/fin-base-service:${FIN_TAG}
ARG AE_API=/usr/local/lib/aggie-experts/experts-api/
COPY package.json ${AE_API}/package.json
RUN cd ${AE_API} && npm install --omit=dev
COPY lib ${AE_API}/lib
COPY index.js ${AE_API}
