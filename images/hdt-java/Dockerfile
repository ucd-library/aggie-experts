ARG HDT_VERSION=v3.0.9

from maven:3-openjdk-17-slim
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

ENV PATH="/opt/hdt-java/bin:${PATH}"

CMD ["/bin/echo", "Available commands: hdt2rdf.sh hdtInfo.sh hdtSearch.sh hdtsparql.sh rdf2hdt.sh"]
