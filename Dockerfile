ARG DAGSTER_IMAGE
FROM ${DAGSTER_IMAGE}

RUN apt-get update && apt-get install -y build-essential make

RUN mkdir -p /opt/harvest
WORKDIR /opt/harvest

COPY harvest/package.json /opt/harvest/package.json
COPY harvest/package-lock.json /opt/harvest/package-lock.json
RUN cd /opt/harvest && \
    npm install --omit=dev

COPY harvest/bin /opt/harvest/bin
COPY harvest/lib /opt/harvest/lib

COPY dagster/defs.py /opt/dagster/dagster_home/defs.py

RUN cd /opt/harvest && npm install -g