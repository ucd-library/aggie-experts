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

# Common web app and harvest code
RUN mkdir -p /opt/commons
COPY commons/package.json /opt/commons/package.json
COPY commons/package-lock.json /opt/commons/package-lock.json
RUN cd /opt/commons && npm install --omit=dev
COPY commons/lib /opt/commons/lib
COPY commons/index.js /opt/commons/index.js

COPY dagster/defs.py /opt/harvest/dagster/defs.py
COPY dagster/lib /opt/harvest/dagster/lib
COPY dagster/dagster.yaml /opt/dagster/dagster_home/dagster.yaml
COPY dagster/celery_config.yaml /opt/dagster/dagster_home/celery_config.yaml
COPY dagster/workspace.yaml /opt/dagster/dagster_home/workspace.yaml

RUN cd /opt/harvest && npm install -g
RUN cd /opt/caskfs && npm install -g