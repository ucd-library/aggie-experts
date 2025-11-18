ARG ANDUIN_AUTH_GATEWAY_IMAGE
FROM ${ANDUIN_AUTH_GATEWAY_IMAGE}

RUN mkdir -p /etc/anduin
COPY additional-services.json /etc/anduin/additional-services.json
ENV ADDITIONAL_SERVICE_LINKS_CONFIG="/etc/anduin/additional-services.json"