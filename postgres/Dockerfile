ARG POSTGRES_IMAGE
FROM ${POSTGRES_IMAGE}

COPY postgresql.conf /etc/postgresql/postgresql.conf

CMD [ "postgres", "-c", "config_file=/etc/postgresql/postgresql.conf" ]