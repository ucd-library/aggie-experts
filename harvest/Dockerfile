ARG TAG
ARG ORG
ARG FUSEKI_IMAGE
ARG EXPERTS_API_IMAGE
ARG FIN_SERVER_IMAGE

# Build sqlcl, tarql seperately, but use FUSEKI as base image
FROM $FUSEKI_IMAGE AS more

#The Oracle SQL developer CLI.  This is a java tool that provides
#a command-line interface to Oracle Services.
ENV SQLCL_VERSION=23.2.0.178.1027
USER root
RUN set -x ; mkdir -p /tmp/builder && \
    cd /tmp/builder && \
    curl -L https://download.oracle.com/otn_software/java/sqldeveloper/sqlcl-${SQLCL_VERSION}.zip -o sqlcl.zip && \
    unzip ./sqlcl.zip && \
    mkdir /usr/local/lib/sqlcl && mv sqlcl/lib /usr/local/lib/sqlcl && \
    mkdir /usr/local/lib/sqlcl/bin && mv sqlcl/bin/sql /usr/local/lib/sqlcl/bin/sqlcl && \
    chmod ug+x /usr/local/lib/sqlcl/bin/sqlcl && \
    ls -al /usr/local/lib/sqlcl/bin/sqlcl && \
    cd .. && rm -rf builder

# Now build tarql
ENV TARQL_VERSION="1.2"
USER root
RUN set -x ; mkdir -p /tmp/builder && \
    cd /tmp/builder && \
    curl -L https://github.com/tarql/tarql/releases/download/v${TARQL_VERSION}/tarql-${TARQL_VERSION}.tar.gz -o ./tarql.tar.gz && \
    tar xzf ./tarql.tar.gz && \
    rm tarql.tar.gz && \
    mv tarql-${TARQL_VERSION} tarql && \
    rm tarql/bin/tarql.bat tarql/README.md && \
    find . && \
    echo JAVA_HOME=${JAVA_HOME} && \
    chmod ug+x ./tarql/bin/tarql && \
    cat ./tarql/bin/tarql && \
    ls -al ./tarql/bin && \
    mv tarql /usr/local/lib && cd /usr/local/lib/tarql && rm -rf builder


# Experts API is shared
FROM $EXPERTS_API_IMAGE AS api

# fin-service is also shared
FROM ${FIN_SERVER_IMAGE} AS fin-base-service

# Now build from fuseki
FROM $FUSEKI_IMAGE

USER root

COPY --from=more /usr/local/lib/sqlcl /usr/local/lib/sqlcl
COPY --from=more /usr/local/lib/tarql /usr/local/lib/tarql

# Set up Google Cloud, google-cloud-cli
RUN apt-get update -y && \
    apt-get install -y git jq zip unzip \
    vim apt-transport-https ca-certificates gnupg dnsutils \
    build-essential  libxml2-utils httpie xmlstarlet && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" |\
  tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
  apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - &&\
    apt-get update -y && apt-get install google-cloud-cli -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Setup node-20
#RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN mkdir -p /etc/apt/keyrings && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | apt-key --keyring /etc/apt/keyrings/nodesource.gpg add -
ENV NODE_MAJOR=20
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install nodejs -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && corepack enable

# Set up some HDT files
RUN mkdir -p /var/lib/fuseki/hdt/
COPY vocabularies/experts.ucdavis.edu%2FFoR/FoR.hdt* /var/lib/fuseki/hdt/
COPY vocabularies/experts.ucdavis.edu%2Fucop/positions.hdt* /var/lib/fuseki/hdt/

# Update FUSEKI_HOME w/ experts data
COPY fuseki ${FUSEKI_HOME}

# Get our experts_import tool
COPY bin/experts_import /usr/local/bin
RUN chmod +x /usr/local/bin/experts_import

# Copy fin-service
ARG FIN_API=/usr/local/lib/fin/api
COPY --from=fin-base-service /fin/api ${FIN_API}
RUN cd ${FIN_API} && npm link

# COPY over experts-api source code
ARG AE_API=/usr/local/lib/aggie-experts/experts-api
COPY --from=api ${AE_API} ${AE_API}
RUN cd ${AE_API} && npm link

ARG AE_CLIENT=/usr/local/lib/aggie-experts/experts-client
COPY experts-client ${AE_CLIENT}
#RUN cd ${AE_CLIENT} && rm -rf package-lock.json node_modules && npm link @ucd-lib/experts-api && npm install -g

# npm rebuild is hack fix for arm64... why is this needed?
RUN cd ${AE_CLIENT} && \
    npm install -g && \
    npm rebuild && \
    npm link @ucd-lib/experts-api

COPY /fuseki-entrypoint.sh /

# Add sqlcl and tarql to bin
ENV PATH=$PATH:/usr/local/lib/sqlcl/bin:/usr/local/lib/tarql/bin
ENV JAVA_OPTS="-Xmx8g"

# You can override this entrypoint if you use this image as your base image but
# if you leave it as is you can use this image to act as a server
WORKDIR $FUSEKI_BASE
CMD "${FUSEKI_HOME}/fuseki-server-hdt"
ENTRYPOINT ["/fuseki-entrypoint.sh" ]
