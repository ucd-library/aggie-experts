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
RUN find . -name node_modules -type d | xargs rm -rf
RUN npm install && \
    (cd client/public && npm install) && \
    npm link @ucd-lib/fin-service-utils && \
    npm link @ucd-lib/fin-api &&\
    npm run dist

# COPY over experts-api source code
ARG AE_API=/usr/local/lib/aggie-experts/experts-api
COPY --from=api ${AE_API} ${AE_API}
RUN (cd ${AE_API} && npm link)

# Models
WORKDIR ${FIN_SERVICE_ROOT}
COPY models models
WORKDIR ${FIN_SERVICE_ROOT}/models
RUN mv package-lock.json package-lock.json- && npm link @ucd-lib/experts-api && npm install

WORKDIR ${FIN_SERVICE_ROOT}
# PROJECT_NAME is application label
ENV PROJECT_NAME=aggie-experts
ENV APP_VERSION=${TAG}

CMD [ "bash", "-c", "tail -f /dev/null"]
