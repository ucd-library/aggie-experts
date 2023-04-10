ARG REF_NAME
ARG ORG

FROM $ORG/fuseki:$REF_NAME

USER root

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
COPY harvest.mk  /usr/local/lib/harvest

# Add startup file
COPY /harvest-functions.sh /
COPY /harvest-entrypoint.sh /

VOLUME /home/ucd.process
WORKDIR /home/ucd.process

# You can override this entrypoint if you use this image as your base image but
# if you leave it as is you can use this image to fetch data and act as a server
#
ENTRYPOINT ["/harvest-entrypoint.sh" ]
