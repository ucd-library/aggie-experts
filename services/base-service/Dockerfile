ARG FIN_SERVER_IMAGE
FROM ${FIN_SERVER_IMAGE}

# FIN_SERVICE_ROOT defined in FIN_SERVER_IMAGE, and is the root of the service

ARG OUR_SERVICE_ROOT=./

# # Client Code
RUN mkdir -p ${FIN_SERVICE_ROOT}/spa

WORKDIR ${FIN_SERVICE_ROOT}
COPY spa spa
WORKDIR ${FIN_SERVICE_ROOT}/spa
RUN rm -rf node_modules
RUN npm ci
RUN npm link @ucd-lib/fin-service-utils
RUN npm link @ucd-lib/fin-api

# Models
WORKDIR ${FIN_SERVICE_ROOT}
COPY models models
WORKDIR ${FIN_SERVICE_ROOT}/models
RUN rm -rf node_modules
RUN npm ci

WORKDIR ${FIN_SERVICE_ROOT}

CMD [ "bash", "-c", "tail -f /dev/null"]
