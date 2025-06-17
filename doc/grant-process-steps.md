# Grant Feed Process Steps

### Position the Aggie Enterprise Weekly XML Extract File

An Aggie Enterprise report is scheduled to run weekly, and produces an XML formatted file containing all UCD grants. This file is emailed to designated recipients and should be uploaded to The Aggie Experts project Google bucket at aggie-enterprise/grants.

1. Download the emailed file to your local drive. Make shure it is named `ae-grants.xml`

2. Use the Google Cloud console to upload the file to the aggie-experts project bucket at `aggie-enterprise/grants`. Be sure to choose to overwrite(replace) the previous version of the file. Previous versions are kept so that the delta(difference) between two versions can be created.

### Run the Grant Feed Process

With the XML target file in place, we can run the grant feed process.

Start-up the Fuseki service only if neccesary.

`$ docker compose up fuseki -d`   starts the fuseki service specifically.

`$ docker compose ps`  to confirm we are running fuseki.

Bash into the fuseki service.

`$ docker compose exec fuseki bash`

This brings you to a bash shell on the fuseki container.

Run the experts grant-feed-process

`$ experts grant-feed-process --log=info --output=grant-out --upload --env PROD -xml 'gs://aggie-enterprise/grants/ae-grants.xml'`

In this example, an output directory will be created at ./grant-out. The csv files produced will be uploaded to the Symplectic FTP site PROD directory. The xml input is specified as the file uploaded previously. Note that is would be possible to target a local file instead.


