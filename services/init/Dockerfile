ARG FIN_ORG
ARG FIN_TAG
FROM ${FIN_ORG}/fin-init:${FIN_TAG}

RUN cd /fin/services && npm rebuild

COPY fcrepo-aggie-experts /etc/ucdlib-service-init/fcrepo-aggie-experts

COPY init-aggie-experts.sh /init-aggie-experts.sh
RUN chmod +x /init-aggie-experts.sh

CMD ["/init-aggie-experts.sh"]
