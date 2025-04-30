## Aggie Experts Docker Images & Deployment

Aggie Experts is deployed as a cluster of Docker containers. The bash build script [../bin/aggie-experts](../bin/aggie-experts) creates a set of docker images and a docker-compose file based on a [template](../docker-template.yaml), environment variables, and command-line options. This allows environment specific build types, local file mounts, and other setup options as needed. The resulting docker-compose.yml file will define the services needed to run the Aggie Experts cluster of containers.

See the manpage for more details on using this tool with [`bin/aggie-experts --help`](./aggie-experts-help.txt)

The `aggie-experts` build script makes use of the cloud build utility `cork-kube` which is installed on the local host and uses Google Cloud Build. This utility manages the image dependencies based on a provided configuration file, [`.cork-build`](../.cork-build). See the [cork-kube](https://github.com/ucd-library/cork-kube) repository for detailed documention.

See also:

[Development Stages and Best Practices](./ae-build-stages.org)

[Data Deployment Steps](./experts-deploy-harvest.md)

