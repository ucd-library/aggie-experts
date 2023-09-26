ARG ORG
ARG TAG
ARG FIN_ORG
ARG FIN_TAG

# Experts API is shared
FROM $ORG/experts-api:$TAG as api

FROM ${FIN_ORG}/fin-base-service:${FIN_TAG}

# FIN_SERVICE_ROOT defined in fin-base-service, and is the root of the service

ARG OUR_SERVICE_ROOT=./

# Client Code
RUN mkdir -p ${FIN_SERVICE_ROOT}/spa

WORKDIR ${FIN_SERVICE_ROOT}
COPY spa spa
WORKDIR ${FIN_SERVICE_ROOT}/spa
RUN rm -rf node_modules
RUN npm ci
RUN npm link @ucd-lib/fin-service-utils
RUN npm link @ucd-lib/fin-api

# COPY over experts-api source code
ARG AE_API=/usr/local/lib/aggie-experts/experts-api
COPY --from=api ${AE_API} ${AE_API}
RUN cd ${AE_API} && npm link

# Models
WORKDIR ${FIN_SERVICE_ROOT}
COPY models models
WORKDIR ${FIN_SERVICE_ROOT}/models
RUN rm -rf node_modules package-lock.json
RUN npm link @ucd-lib/experts-api && npm install

WORKDIR ${FIN_SERVICE_ROOT}

CMD [ "bash", "-c", "tail -f /dev/null"]
