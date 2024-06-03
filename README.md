# aggie-experts-public-issues
Publicly reported feedback and issues for Aggie Experts

To report an issue or provide feedback go to [https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose](https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose)

Click [Issues](https://github.com/ucd-library/aggie-experts-public-issues/issues) above to see all reported issues.

## Usage

### Env File
Here are some common parameters:
| Param | Description |
| ----- | ----------- |
| FIN_URL|
| HOST_PORT|
| FIN_SERVICE_ACCOUNT_NAME |
| FIN_SERVICE_ACCOUNT_SECRET |
| LOCAL_KEYCLOAK |
| JWT_SECRET |
| JWT_ISSUER |
| JWT_JWKS_URI | 
| OIDC_CLIENT_ID | 
| OIDC_BASE_URL |
| OIDC_SECRET |
| TAG |
| GCS |
| CDL_PROPAGATE_CHANGES |
| GA4_ENABLE_STATS | 
| GA4_MEASUREMENT_ID |

Here is a good env for local development:
```
FIN_URL=https://experts.library.ucdavis.edu
TAG=1.0.0
GCS=fcrepo-prod
CDL_PROPAGATE_CHANGES=true
GA4_ENABLE_STATS=true
```

## Production Deployment

The production deployment depends on multiple VMs and docker constellations,
controlled with docker-compose files.  An [Overview
Diagram](https://docs.google.com/drawings/d/1fLANXV295-rPT_NLGNDRyE1cVLNi30JMLDXwReywRjU/edit?usp=sharing)
gives a general description of the deployment setup.  All traffic to the website
is directed to an apache instance that acts as a routing service to the
underlying backend service.  The router does some coarse scale redirection;
maintains the SSL certificates, but mostly monitors which of two potential
backend services are currently operational. It does this by monitoring specific
ports from two VMs gold and blue. Note blue and gold are only available within
the libraries staff VPN.  The router (router.experts.library.ucdavis.edu) will
dynamically switch between the backends based on which is currently operational.
If both are operational, it will switch between them, if neither, it will throw
a 400 error.  For Aggie Experts only one backend should be operational at any
one time, but the router doesn't care about that.

| machine | specs |
| --- | --- |
| blue.experts.library.ucdavis.edu | 32Gb, 2.5Tb, 8cpu |
| gold.experts.library.experts.edu | 32Gb, 2.5Tb, 8cpu |
| router.experts.library.ucdavis.edu | 4Gb, 25Gb, 8cpu |

On a typical redeployment of the system, you should never need to worry about
the router configuration. However, you are often very interested in what backend server is operational.

The router manages this by including a routing indicator in the clients cookies.
The example below shows that the ROUTEID is set to `experts.blue`.

```bash
curl -I https://experts.ucdavis.edu
```

```txt
HTTP/1.1 200 OK
Date: Thu, 23 May 2024 22:47:05 GMT
Server: Apache/2.4.53 (Red Hat Enterprise Linux) OpenSSL/3.0.7
x-powered-by: Express
accept-ranges: bytes
cache-control: public, max-age=0
last-modified: Fri, 26 Apr 2024 22:28:56 GMT
etag: W/"1d2a-18f1c86a040"
content-type: text/html; charset=UTF-8
content-length: 7466
Set-Cookie: ROUTEID=experts.blue; path=/
```

The router will try and maintain the same connection with the backend if
possible, but if not it will reset this cookie, and switch to whatever backend
is working.

In our setup, there should never be two instances working, except for the few
minutes where a redeployment is in progress.  The general setup is relatively
straightforward.  The only major consideration, is that while you are preparing
your system, you need to make sure that you are *not* using the production
deployment port, otherwise the router will include your setup prematurely.

Here are the steps to deploy to blue and gold. Each new deployment should target
the non-running instance, alternating between blue and gold.

### Deployment Steps

#### Identify server
Since we switch between blue and gold servers, you are never really sure which
is in production, so you have to check the ROUTEID cookie with `curl -I
https://experts.ucdavis.edu`.

Fill in the following instructions with this value:

```bash
cur=gold # or blue
case $cur in "gold") new="blue";; "blue") new="gold";; *) new="BAD"; esac
version=1.0.0 # or whatever
dir=1.0-1 # Major.Minor-ServerInstance

alias dc=docker-compose # or 'docker compose' 
```

#### Initialize new service

First, initialize your new service.  This example shows where you are simply
updating the production images, but the steps are required for any changes.
These commands simply drop any previous data, and get the latest required
versions.

```bash
  ssh ${new}.experts.library.ucdavis.edu
  cd /etc/aggie-experts
  git clone https://github.com/ucd-library/aggie-experts.git ${major}.${minor}-1
  cd ${major}-${minor}-1
  git checkout ${version}
  bin/aggie-experts --env=prod|stage setup
  dc pull
```

If you run into an error when pulling the images, one of the following might be your issue:
- docker is not authorized to pull images: `gcloud auth configure-docker`
- you are not logged into gcloud: `gcloud auth login`
- you have the wrong project set: `gcloud config set project aggie-experts`

```bash
dc up -d
```

You can follow along and monitor the logs to see that the initialization script
worked properly.

### Retire current service

At this point, you can vist the production pages, and verify that both backends
are running.  This is okay, since you cannot write to the current server.  Once
you have convinced yourself that things look good, you can stop (but don't bring
down) the cur (now old) server.  You stop it, so if there is a big problem, you
can 

```bash
ssh ${cur}.library.ucdavis.edu
cd /etc/aggie-experts/${old}
dc stop
```
