# Data Deployment Steps

The harvest script cab be run on any server, but it is good practice run it from the stage server.
Login to the server(ssh to stage server for e.g.). this could be blue.experts.library.ucdavis.edu or gold.experts.library.ucdavis.edu

Move to the aggie-experts dir
$ cd /etc/aggie-experts

There will likely be multiple versions of the codebase already on the server
$ ls -l  # to list versions

Move to the current version which may be running currently
$ cd 2-1 # for example

Look for running services
$ docker compose ps 

Check the FIN config settings
$ grep FIN docker-compose.yaml 
note where we are running (e.g. stage)

## Create another version

If you want to deploy a new or different version of the codebase, you need to clone it to a new directory

$ cd  ..  # back to aggie-experts

$ git clone https://github.com/ucd-library/aggie-experts.git 2-4 # (for example)

$ cd 2-4  # go to new version

$ git describe    # check the version

if the current dev version is not desired checkout the last good tag. (e.g. 2.2)

## Run the Setup Process

The setup process creates a docker-compose.yml file and copies over the service account file

$ bin/aggie-experts —no-test —env=stage setup 

Note: There is no requirement for a .env file but one can be used to set the bucket to use and to enable/disable data hydration. For example:

GCS_BUCKET=fcrepo-2
GCS_INIT_DATA_HYDRATION=true   

...would use the GCS bucket fcrepo-2 and import the data. Setting GCS_INIT_DATA_HYDRATION=false is useful when you don't want the data imported on startup. 

## Data Initialization

Start-up the Fuseki service only (we only want to harvest data at this point)

$ docker compose up fuseki -d   # starts the fuseki service specifically

$ docker compose ps  # to confirm we are running fuseki

Use byobu to run harvest in an independent shell that can be left running and come back to

$ byobu   # starts a byobu shell 

Bash into the fuseki service 

$ docker compose exec fuseki /harvest-entrypoint.sh bash    # this brings you to a bash shell on the fuseki container

You should see a prompt similar to:
ucd.process@4cdbbe11f9ef:~$       

## Run the harvest process

$ experts cdl --log=info —groups=1576   # check oapolicy for group IDs. 1576 = all UCD

This starts the harvest in the foreground and logs to the console as it works.

Open another byobu terminal to monitor the cache being built by the harvest.

$ docker compose exec fuseki /harvest-entrypoint.sh bash   # for another term

$ ls cache/     # will list expert directories

$ ls cache/ | wc -l  # will show a count of experts harvested so far which you can monitor for progress.

Now, you can log out, and the harvest will still be running. Later you can ssh back into the server and restart byobu to continue.


