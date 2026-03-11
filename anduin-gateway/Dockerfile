ARG ANDUIN_AUTH_GATEWAY_IMAGE
ARG CASKFS_IMAGE
FROM ${CASKFS_IMAGE} as caskfs
FROM ${ANDUIN_AUTH_GATEWAY_IMAGE}

RUN mkdir -p /cork-build-info
COPY --from=caskfs /cork-build-info/caskfs.json /cork-build-info/caskfs.json

RUN mkdir -p /etc/anduin
COPY additional-services.json /etc/anduin/additional-services.json
ENV ADDITIONAL_SERVICE_LINKS_CONFIG="/etc/anduin/additional-services.json"