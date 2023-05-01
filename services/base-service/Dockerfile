ARG FIN_SERVER_IMAGE
FROM ${FIN_SERVER_IMAGE}

# FIN_SERVICE_ROOT defined in FIN_SERVER_IMAGE, and is the root of the service

ARG OUR_SERVICE_ROOT=./

# # Client Code
RUN mkdir -p ${FIN_SERVICE_ROOT}/ucd-lib-client

WORKDIR ${FIN_SERVICE_ROOT}
COPY ucd-lib-client ucd-lib-client
WORKDIR ${FIN_SERVICE_ROOT}/ucd-lib-client
RUN rm -rf node_modules
RUN npm ci
RUN npm link @ucd-lib/fin-service-utils
RUN npm link @ucd-lib/fin-api

# Models
WORKDIR ${FIN_SERVICE_ROOT}
COPY models models

CMD [ "bash", "-c", "tail -f /dev/null"]
