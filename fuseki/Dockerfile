ARG OPENJDK=openjdk:17-slim-bullseye
ARG MAVEN=maven:3-openjdk-17-slim
ARG JENA_VERSION=5.1.0
ARG HDT_VERSION=v3.0.10

# We install hdt binaries completely seperately from our fuseki extras below
FROM $MAVEN AS hdt-java
ARG HDT_VERSION

USER root

RUN apt-get update -y -qq &&\
    apt-get install -y -qq --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/tmp

RUN git clone --branch=$HDT_VERSION https://github.com/rdfhdt/hdt-java.git \
  && cd hdt-java \
  && cd hdt-java-package \
  && mvn assembly:single \
  && mv target/hdt-java-*/hdt-java-* /opt/hdt-java

# This is where HDT modules are installed
FROM $MAVEN AS extra

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

FROM $OPENJDK AS openjdk

ENV YQ_VERSION="3.3.2"

# This is replicated at run time in openjdk-functions.sh
#ENV HOME=/home/ucd.process
#RUN useradd --system --no-user-group --home-dir /home/ucd.process --create-home --shell /bin/bash --uid ${UID} --gid 0 ucd.process && \

#   Ensure that the local paths are preferred
ENV PATH=/usr/local/bin:$PATH
ENV LANG=C.UTF-8

#   The two lines below are there to prevent a red line error to be shown about
#   apt-utils not being installed
#
ARG DEBIAN_FRONTEND=noninteractive
SHELL ["/bin/bash", "-c"]

#
#   dev tools and dependencies in one RUN statement
#
RUN apt-get update -y -qq && \
    apt-get install -y -qq --no-install-recommends \
#    	uuid-dev \
#    	dirmngr \
    	gnupg \
    	less \
    	groff \
		ca-certificates \
		netbase \
		git \
    	wget \
    	curl \
		unzip \
    	jq \
    rsync \
    make \
    httpie \
    	&& \
	apt-get upgrade -y && \
	apt-get dist-upgrade -y && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get --purge -y autoremove && \
    apt-get clean -y && \
    rm -rf /var/lib/apt/lists/*

# FINALLY, the actual fuseki image
FROM openjdk
# These need to be reinitialized

# Config and data
ARG JENA_VERSION

ARG FUSEKI_HOME=/usr/share/fuseki
#ARG FUSEKI_JAR=jena-fuseki-server-${JENA_VERSION}.jar
ARG FUSEKI_BASE=/etc/fuseki


USER root
ENV LANG=C.UTF-8
RUN set -eux && \
    apt-get update; \
    apt-get install -y --no-install-recommends \
       bash curl ca-certificates findutils coreutils pwgen procps wait-for-it && \
    rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.documentation=https://jena.apache.org/documentation/fuseki2/
LABEL org.opencontainers.image.title="Apache Jena Fuseki"
LABEL org.opencontainers.image.version=${JENA_VERSION}
LABEL org.opencontainers.image.licenses="(Apache-2.0 AND (GPL-2.0 WITH Classpath-exception-2.0) AND GPL-3.0)"
#LABEL org.opencontainers.image.authors "Apache Jena Fuseki by https://jena.apache.org/; this image by https://orcid.org/0000-0001-9842-9718"

# Add HDT data
COPY --from=hdt-java /opt/hdt-java/ /opt/hdt-java/
# Add to PATH
ENV PATH=$PATH:/opt/hdt-java/bin


# Add in Jena files
WORKDIR /tmp
ARG JENA_REPO=https://dlcdn.apache.org/jena/binaries

#RG JENA_TAR_SHA512=04f87c42a3b5fe65ad554beb8a1ef90ca7e0305d306fb18a15bb808891c259f420ab4f630e6b4abbb017e32284f97e23f7b848a21dc57f32ad53f604cb82e28b
ARG JENA_TAR_SHA512=f426275591aaa5274a89cab2f2ee16623086c5f0c7669bda5b2cead90089497e57098885745fd88e3c7db75cbaac48fe58f84ec9cd2dbb937592ff2f0ef0f92e
RUN echo "$JENA_TAR_SHA512 jena.tar.gz" > jena.tar.gz.sha512
# Download/check/unpack/move in one go (to reduce image size)
RUN     curl --location --silent --show-error --fail --retry-connrefused --retry 3 --output jena.tar.gz ${JENA_REPO}/apache-jena-$JENA_VERSION.tar.gz && \
    sha512sum -c jena.tar.gz.sha512

RUN tar zxf jena.tar.gz && \
	mv apache-jena* /usr/local/apache-jena && \
	rm jena.tar.gz* && \
	cd /usr/local/apache-jena && rm -rf *javadoc* *src* bat

# Add to PATH
ENV PATH=$PATH:/usr/local/apache-jena/bin
# Check it works
RUN riot  --version

# Install Fuseki Server (Repeat some ARGS)
WORKDIR /tmp
ARG JENA_REPO=https://dlcdn.apache.org/jena/binaries

# published sha512 checksum
#ARG FUSEKI_TAR_MD5=84079078b761e31658c96797e788137205fc93091ab5ae511ba80bdbec3611f4386280e6a0dc378b80830f4e5ec3188643e2ce5e1dd35edfd46fa347da4dbe17
ARG FUSEKI_TAR_MD5=50d33937092e8120d57f503b6e96ef988894602aa060ff945ec3aecf0349b0b22250e158bb379d0300589653dc9d6f3e6eb2b9790b5125144108dd6f19dc41e6
RUN echo "$FUSEKI_TAR_MD5 fuseki.tar.gz" > fuseki.tar.gz.sha512
# Download/check/unpack/move in one go (to reduce image size)

RUN curl --location --silent --show-error --fail --retry-connrefused --retry 3 --output fuseki.tar.gz ${JENA_REPO}/apache-jena-fuseki-$JENA_VERSION.tar.gz && \
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
ENV JVM_ARGS="-Xmx2g -Djena.scripting=true"

# Where we start our server from
WORKDIR $FUSEKI_HOME
EXPOSE 3030
ENTRYPOINT ["/fuseki-entrypoint.sh"]
CMD "${FUSEKI_HOME}/fuseki-server-hdt"
#CMD "/usr/bin/curl" "-sS" "--fail" "http://localhost:3030/$/ping"
