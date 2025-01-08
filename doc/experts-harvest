##Data Deployment Steps

ssh to stage server. Could be blue.experts.library.ucdavis.edu or gold.experts.library.ucdavis.edu

$ cd /etc/aggie-experts

$ ls -l to list versions

$ cd to the current version

$ docker compose ps to see running services

$ grep FIN docker-compose.yaml to see FIN config settings

note where we are running (e.g. stage)

###Create another version

$ cd  ..  // (back to aggie-experts)

$ git clone https://github.com/ucd-library/aggie-experts.git 3.1 // (desired version)

$ cd 3-1  // go to new version

$ git describe    // check the version

if the current dev version is not desired checkout the last good tag. (e.g. 2.4)

**Run Setup Process**

$ bin/aggie-experts —no-test —env=stage setup. // this creates docker-compose.yml and copies over the service account file

Note: no requirement for a .env file but one can be used to set the bucket to use and to enable/disable data hydration. For example:

GCS_BUCKET=fcrepo-2
GCS_INIT_DATA_HYDRATION=true   // needed for a new data deployment

**Data Initialization**

Start-up Fuseki only (we only want to harvest data at this point)

$ docker compose up fuseki -d   // starts the fuseki service specifically

$ docker compose ps   // to confirm we are running fuseki

Use byobu to run harvest in an independent shell that can be left running and come back to

$ byobu    // starts a byobu shell 

Bash into the fuseki service

$ docker compose exec fuseki /harvest-entrypoint.sh bash    // this brings you to a bash shell on the fuseki container

ucd.process@4cdbbe11f9ef:~$       // you should see a similar prompt

**Run the harvest process**

$ experts cdl --log=info —groups=1576   // check oapolicy for group IDs. 1576 = all UCD

This starts the harvest in the foreground and logs to the console as it works.

Open another byobu terminal to monitor the cache being built by the harvest.

$ docker compose exec fuseki /harvest-entrypoint.sh bash   // for another term

$ ls cache/     // will list expert directories

$ ls cache/ | wc -l  // will show a count of experts harvested so far

Now, you can log out, and the harvest will still be running. Later you can ssh back into the server and restart byobu to continue.


