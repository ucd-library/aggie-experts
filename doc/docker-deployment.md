## Aggie Experts Docker Images & Deployment

Aggie Experts is deployed as a cluster of Docker containers. The bash build script [../bin/aggie-experts](../bin/aggie-experts) creates a set of docker images and a docker-compose file based on a [template](../docker-template.yaml), environment variables, and command-line options. This allows environment specific builds, local file mounts, and other setup options as needed. The resulting docker-compose.yml file will define the services needed to run the Aggie Experts cluster of containers.

See the manpage for more details with the help option. (bin/aggie-experts --help)
