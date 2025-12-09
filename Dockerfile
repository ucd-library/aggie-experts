ARG DAGSTER_IMAGE
ARG CASKFS_IMAGE
FROM ${CASKFS_IMAGE} as caskfs
FROM ${DAGSTER_IMAGE}

RUN apt-get update && \
    apt-get install -y wget gnupg2 lsb-release && \
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/postgres.gpg && \
    apt-get update && \
    apt-get install -y \
    build-essential make \
    postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/caskfs
WORKDIR /opt/caskfs
COPY --from=caskfs /opt/caskfs/package.json package.json
RUN npm install --omit=dev
COPY --from=caskfs /opt/caskfs/src src

RUN mkdir -p /opt/harvest
WORKDIR /opt/harvest

COPY harvest/package.json /opt/harvest/package.json
COPY harvest/package-lock.json /opt/harvest/package-lock.json
RUN cd /opt/harvest && \
    npm install --omit=dev

COPY harvest/bin /opt/harvest/bin
COPY harvest/lib /opt/harvest/lib
COPY harvest/vocabularies /opt/harvest/vocabularies

COPY dagster/defs.py /opt/harvest/defs.py

RUN cd /opt/harvest && npm install -g
RUN cd /opt/caskfs && npm install -g