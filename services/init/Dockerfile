ARG FIN_INIT

FROM ${FIN_INIT}

RUN cd /fin/services && npm rebuild

RUN cd /fin/services && npm rebuild

COPY fcrepo-aggie-experts /etc/ucdlib-service-init/fcrepo-aggie-experts

COPY init-aggie-experts.sh /init-aggie-experts.sh
RUN chmod +x /init-aggie-experts.sh

CMD ["/init-aggie-experts.sh"]
