#! /usr/bin/make -f
SHELL:=/bin/bash

define pod

=pod

=head1 NAME

Dockerfile Tools

=head1 SYNOPSIS

This Makefile is used to manage our workflow Dockerfiles.

  make [-n] [dest=cloud] [image] [image ...]

=head2 Methods / Files

=item C<image>

Adding an image name will build the image.  The if [dest=cloud] then it will be a cloud build,
otherwise it will be a local build.

=cut

endef

mkfile_path := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

dest:=local
org.local:=localhost/aggie-experts
org.cloud:=gcr.io/ucdlib-pubreg

repo:=$(shell basename -s .git $$(git config --get remote.origin.url))
branch:=$(shell git rev-parse --abbrev-ref HEAD)
tag:=$(shell git tag --points-at HEAD)
base:=$(shell git rev-parse --show-toplevel)
gcloud.user:=$(shell gcloud auth list --filter="status:ACTIVE"  --format="value(account)")
sha:=$(shell git log -1 --pretty=%h)

images:=openjdk fuseki harvest harvest-grants harvest-person openjdk-tarql openjdk-sqlcl hdt-java

INFO::
	@pod2usage -exit 0 ${MAKEFILE_LIST}

.PHONY::${images}

images: ${images}

# This is where you set any other dependancies
openjdk-sqlcl:: openjdk
openjdk-tarql:: openjdk
fuseki:: openjdk hdt-java

harvest::fuseki openjdk-sqlcl openjdk-tarql
harvest-grants::fuseki openjdk-sqlcl openjdk-tarql
harvest-person::fuseki

define build-local
$(warning build-local $1)

.PHONY:: $1

$1::
	export DOCKER_BUILDKIT=1;\
	docker build \
	     --build-arg BUILDKIT_INLINE_CACHE=1 \
	     --build-arg ORG=${org.${dest}} --build-arg REF_NAME=${branch}\
	     -t ${org.${dest}}/$1:${branch} ${base}/images/$1

ifneq ($(strip ${tag}),)
$1::
	docker tag ${org.${dest}}/$1:${branch} ${org.${dest}}/$1:${tag}
endif

endef

#$(warning build-cloud $1)
define build-cloud

.PHONY:: $1

$1::
	gcloud config set project digital-ucdavis-edu;\
  gcloud builds submit \
    --config ${base}/images/cloudbuild.yaml \
    --substitutions=_UCD_LIB_INITIATOR=${gcloud.user},REPO_NAME=${repo},REF_NAME=${tag},BRANCH_NAME=${branch},SHORT_SHA=${sha},_IMAGE=$1\
  ${base}/images/$1
endef

ifeq (${dest},cloud)
ifeq ($(strip ${tag}),)
$(error You have specified a cloud build with no tag)
endif
endif

$(foreach i,${images},$(eval $(call build-${dest},$i)))
