ARG FIN_SERVER_IMAGE

FROM ${FIN_SERVER_IMAGE}
ARG AE_API=/usr/local/lib/aggie-experts/experts-api/
COPY package.json ${AE_API}/package.json
RUN cd ${AE_API} && npm install --omit=dev
COPY lib ${AE_API}/lib
COPY index.js ${AE_API}
