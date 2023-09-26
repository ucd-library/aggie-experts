ARG TAG
ARG ORG

# Build sqlcl, tarql seperately, but use FUSEKI as base image
FROM $ORG/fuseki:$TAG as more

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
FROM $ORG/experts-api:$TAG as api

# Now build from fuseki
FROM $ORG/fuseki:$TAG

USER root

COPY --from=more /usr/local/lib/sqlcl /usr/local/lib/sqlcl
COPY --from=more /usr/local/lib/tarql /usr/local/lib/tarql

# Updating experts-client for downloads will eliminate the need for
# build-essential httpie, xmlstarlet
# and later below  cdl-element

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

# Setup node-20 https://github.com/nodesource/distributions#debinstall
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
RUN rm -rf /var/lib/apt/lists/*

# Set up some HDT files
RUN mkdir -p /var/lib/fuseki/hdt/
COPY vocabularies/experts.ucdavis.edu%2FFoR/FoR.hdt* /var/lib/fuseki/hdt/
COPY vocabularies/experts.ucdavis.edu%2Fucop/positions.hdt* /var/lib/fuseki/hdt/

# Update FUSEKI_HOME w/ experts data
COPY fuseki ${FUSEKI_HOME}

# Get our UCDID tool
COPY ucdid /usr/local/bin
RUN chmod +x /usr/local/bin/ucdid

# Copy over cdl-elements
COPY cdl-elements /usr/local/bin
RUN chmod +x /usr/local/bin/cdl-elements
# XML2JSON
RUN cd /tmp && npm install -g xml2json --unsafe-perm


# COPY over experts-api source code
ARG AE_API=/usr/local/lib/aggie-experts/experts-api
ARG AE_CLIENT=/usr/local/lib/experts-client
COPY --from=api ${AE_API} ${AE_API}
RUN cd ${AE_API} && npm link
COPY experts-client ${AE_CLIENT}
WORKDIR ${AE_CLIENT}
RUN npm link @ucd-lib/experts-api && npm install && npm install -g

# Setup a place to hold the Makefile data
RUN mkdir /usr/local/lib/harvest
COPY harvest /usr/local/lib/harvest

# Add startup file
COPY /harvest-entrypoint.sh /

# Add sqlcl and tarql to bin
ENV PATH=$PATH:/usr/local/lib/sqlcl/bin:/usr/local/lib/tarql/bin
ENV JAVA_OPTS="-Xmx8g"

VOLUME /home/ucd.process
WORKDIR /home/ucd.process

# You can override this entrypoint if you use this image as your base image but
# if you leave it as is you can use this image to fetch data and act as a server
#
ENTRYPOINT ["/harvest-entrypoint.sh" ]