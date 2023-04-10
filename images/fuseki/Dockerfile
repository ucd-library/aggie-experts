ARG ORG
ARG REF_NAME

ARG JENA_VERSION=4.7.0

# We install hdt binaries completely seperately from our fuseki extras below
FROM $ORG/hdt-java:$REF_NAME as hdt-java

from maven:3-openjdk-17-slim as extra

USER root

RUN apt-get update -y -qq &&\
    apt-get install -y -qq --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/tmp/extra /fuseki/extra
WORKDIR /var/tmp/extra
COPY extra/pom.xml .

# From http://www.jcgonzalez.com/maven-just-copy-dependencies
RUN mvn dependency:copy-dependencies -DoutputDirectory=/fuseki/extra

FROM $ORG/openjdk:$REF_NAME
# These need to be reinitialized
ARG ORG

# Config and data
ARG JENA_VERSION

ARG FUSEKI_HOME=/usr/share/fuseki
#ARG FUSEKI_JAR=jena-fuseki-server-${JENA_VERSION}.jar
ARG FUSEKI_BASE=/etc/fuseki


USER root
ENV LANG C.UTF-8
RUN set -eux && \
    apt-get update; \
    apt-get install -y --no-install-recommends \
       bash curl ca-certificates findutils coreutils pwgen procps wait-for-it && \
    rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.documentation https://jena.apache.org/documentation/fuseki2/
LABEL org.opencontainers.image.title "Apache Jena Fuseki"
LABEL org.opencontainers.image.version ${JENA_VERSION}
LABEL org.opencontainers.image.licenses "(Apache-2.0 AND (GPL-2.0 WITH Classpath-exception-2.0) AND GPL-3.0)"
#LABEL org.opencontainers.image.authors "Apache Jena Fuseki by https://jena.apache.org/; this image by https://orcid.org/0000-0001-9842-9718"

# Add HDT data
COPY --from=hdt-java /opt/hdt-java/ /opt/hdt-java/
# Add to PATH
ENV PATH $PATH:/opt/hdt-java/bin


# Add in Jena files
WORKDIR /tmp
ARG JENA_REPO=https://repo1.maven.org/maven2/org/apache/jena

ARG JENA_TAR_SHA512=db8d05c28d890b5456f08e277d04c6b15fa10c20740430ce60de38689ff136e21a3b1cce298cd429c21b7af0a0a858080880b3fee0e121d9b68801e0b67ec51b
RUN echo "$JENA_TAR_SHA512 jena.tar.gz" > jena.tar.gz.sha512
# Download/check/unpack/move in one go (to reduce image size)
RUN     curl --location --silent --show-error --fail --retry-connrefused --retry 3 --output jena.tar.gz ${JENA_REPO}/apache-jena/${JENA_VERSION}/apache-jena-$JENA_VERSION.tar.gz && \
    sha512sum -c jena.tar.gz.sha512

RUN tar zxf jena.tar.gz && \
	mv apache-jena* /usr/local/apache-jena && \
	rm jena.tar.gz* && \
	cd /usr/local/apache-jena && rm -rf *javadoc* *src* bat

# Add to PATH
ENV PATH $PATH:/usr/local/apache-jena/bin
# Check it works
RUN riot  --version

# Install Fuseki Server (Repeat some ARGS)
WORKDIR /tmp
ARG JENA_REPO=https://repo1.maven.org/maven2/org/apache/jena

# published sha512 checksum
ARG FUSEKI_TAR_MD5=9646343a23c2563357207f559cb7437aa91b52d02b87e70d77b746b609e93ed0ad9dce06e072f864d53422946f24aa8ee60d9c594c1f82e8f2ab226eba56e474
RUN echo "$FUSEKI_TAR_MD5 fuseki.tar.gz" > fuseki.tar.gz.sha512
# Download/check/unpack/move in one go (to reduce image size)

RUN curl --location --silent --show-error --fail --retry-connrefused --retry 3 --output fuseki.tar.gz ${JENA_REPO}/apache-jena-fuseki/${JENA_VERSION}/apache-jena-fuseki-$JENA_VERSION.tar.gz && \
    sha512sum -c fuseki.tar.gz.sha512


RUN tar zxf fuseki.tar.gz && \
    mv apache-jena-fuseki* $FUSEKI_HOME && \
    rm fuseki.tar.gz* && \
    cd $FUSEKI_HOME && rm -rf fuseki.war && chmod 755 fuseki-server

# Get our extra jars
COPY --from=extra /fuseki/extra/* $FUSEKI_HOME/extra/

# Copy to FUSEKI_BASE
COPY fuseki $FUSEKI_HOME

# Test the install by testing it's ping resource
RUN  $FUSEKI_HOME/fuseki-server-hdt & \
     sleep 5 && \
     curl -sS --fail 'http://localhost:3030/$/ping'

# No need to kill Fuseki as our shell will exit after curl

# As "localhost" is often inaccessible within Docker container,
# we'll enable basic-auth with a random admin password
# (which we'll generate on start-up)
COPY fuseki-functions.sh /
COPY fuseki-entrypoint.sh /
RUN chmod 755 /fuseki-entrypoint.sh

ENV FUSEKI_HOME=${FUSEKI_HOME}
ENV FUSEKI_BASE=${FUSEKI_BASE}
#ENV FUSEKI_JAR=${FUSEKI_JAR}

# Where we start our server from
WORKDIR $FUSEKI_HOME
EXPOSE 3030
ENTRYPOINT ["/fuseki-entrypoint.sh"]
CMD "${FUSEKI_HOME}/fuseki-server-hdt"
#CMD "/usr/bin/curl" "-sS" "--fail" "http://localhost:3030/$/ping"
