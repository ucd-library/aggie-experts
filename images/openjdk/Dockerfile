ARG ORG
ARG REF_NAME

FROM openjdk:17-slim-bullseye

ENV YQ_VERSION="3.3.2"

# The example this came from creates a new user in the Dockerfile.  This is
# nice, but if you want to match your own UserID for bind mounts this has to be
# done by the container, not the image.  An alternative (better?) method might
# be to have a ucd.process user on all dev machines, and standardize this UID
# for our instances.

# This is replicated at run time in openjdk-functions.sh
#ARG UID=2000
#ENV HOME=/home/ucd.process
#RUN useradd --system --no-user-group --home-dir /home/ucd.process --create-home --shell /bin/bash --uid ${UID} --gid 0 ucd.process && \
#    chgrp -Rf root /home/ucd.process && chmod -Rf g+w /home/ucd.process


#   Ensure that the local paths are preferred
ENV PATH /usr/local/bin:$PATH
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

#   just to be sure, everything we added to the home directory is owned by user
#   ucd.process and group root (see openshift comments at the top of this
#   dockerfile)
#
#	cd /home/ucd.process && \
#	chown -vR ucd.process:root .

COPY openjdk-functions.sh openjdk-entrypoint.sh /

#
# 	now we leave the image to run as user ucd.process from its home directory
#
#USER ucd.process
WORKDIR /home/ucd.process
ENTRYPOINT [ "/openjdk-entrypoint.sh" ]
