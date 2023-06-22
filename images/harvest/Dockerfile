ARG REF_NAME
ARG ORG

FROM $ORG/openjdk-sqlcl:$REF_NAME as sqlcl
FROM $ORG/openjdk-tarql:$REF_NAME as tarql

FROM $ORG/fuseki:$REF_NAME

USER root

COPY --from=sqlcl /usr/local/lib/sqlcl /usr/local/lib/sqlcl
COPY --from=tarql /usr/local/lib/tarql /usr/local/lib/tarql

# Set up Google Cloud, google-cloud-cli
RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y git jq zip unzip vim apt-transport-https ca-certificates gnupg dnsutils

RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" |\
  tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
  apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - &&\
  apt-get update -y && apt-get install google-cloud-cli -y

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

# Setup a place to hold the Makefile data
RUN mkdir /usr/local/lib/harvest
COPY harvest /usr/local/lib/harvest

# COPY over experts-client source code
#COPY experts-client /var/lib/experts-client
#RUN cd /var/lib/experts-client && npm ci

# Add startup file
COPY /harvest-entrypoint.sh /

# Add sqlcl and tarql to bin
ENV PATH=$PATH:/usr/local/lib/sqlcl/bin:/usr/local/lib/tarql/bin

VOLUME /home/ucd.process
WORKDIR /home/ucd.process

# You can override this entrypoint if you use this image as your base image but
# if you leave it as is you can use this image to fetch data and act as a server
#
ENTRYPOINT ["/harvest-entrypoint.sh" ]
