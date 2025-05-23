ARG EXPERTS_API_IMAGE
ARG FIN_SERVER_IMAGE

# Experts API is shared
FROM $EXPERTS_API_IMAGE AS api

FROM ${FIN_SERVER_IMAGE}
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
RUN npm install && npm link @ucd-lib/experts-api

WORKDIR ${FIN_SERVICE_ROOT}
# PROJECT_NAME is application label
ENV PROJECT_NAME=aggie-experts

CMD [ "bash", "-c", "tail -f /dev/null"]
