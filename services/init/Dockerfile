ARG INIT_BASE
ARG FIN_SERVER_IMAGE
FROM ${FIN_SERVER_IMAGE} as fin-server
FROM ${INIT_BASE}

COPY --from=fin-server /fin/api /fin-api
RUN cd /fin-api && npm link

RUN apt-get update && apt-get install -y wait-for-it

COPY fcrepo /etc/ucdlib-service-init/fcrepo
COPY docker-run.sh /


CMD /docker-run.sh