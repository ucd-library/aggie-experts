# Deploy a new AggieExperts Instance

The typical method used to update Aggie Experts is to; create a new docker
constellation setup as stage, harvest new data, import the data, test the new
service, deploy that a the new server, and stop the previous version.

## Create a new AggieExperts constellation

We toggle our production instance between blue|gold.experts.library.ucdavis.edu.
If production is runnning on gold, then we'll create the stage version on blue.
The instances are all maintained in
`file://blue|gold.experts.library.ucdavis.edu/etc/aggie-experts`.

There will likely be multiple versions of the codebase already on the server:

```bash
cd /etc/aggie-experts;
ls -l
```

There is no specific requirement on how the instances are named, but we use the
format `${MAJOR}-${deploynumber}`.  Where `${MAJOR}` is the major release of
AggieExperts, and `${deploynumber}` is the number of times this `${MAJOR}`
instance has been deployed.  `{$MAJOR}` is used, because you should be able to
update to any new revision of Aggie Experts without needed to update the data.
`${deploynumber}` helps keep track of the more recent versions being used.

Under normal circumstances, there shouldn't be any docker containers running.
If you see any via `docker ps`, then you need to investigate what is currently
active on the system.  However, see the *Harvest new data* section below for an
important exception.

We create our new instance by cloning the aggie-experts project into a new
directory.  Let's imagine we are launching a new instance based on version 4.0.2
of AggieExperts:

``` bash
cd /etc/aggie-experts
MAJOR=4  # imagine there was already a 4-0, so we are creating 4-1
git clone --branch=4.0.2  https://github.com/ucd-library/aggie-experts.git 4-1
```

Note, in practice, I usually just clone the default `dev` branch, and then go in
and `git checkout 4.0.2`, since it's more natural.

Next, we simply need to have create a setup for running on stage.

``` bash
cd /etc/aggie-experts/4-1
bin/aggie-experts --no-gcs --no-test --env=stage setup
```

*Note: it's unclear now whether going forward aggie-experts will initialize from
 Google Cloud Storage (gcs) or not.  The newest version of fin causes some
 issues using this reliably, and honestly, I'm not sure I see the utility.  For
 this example we are using `--no-gcs`, which prevents the GCS container from
 even being added to the constellation.*

*Note: one thing `--no-test` does is verify we are running on either blue or
 gold. However this requires a proper ~resolv.conf~ file that is sometimes
 changed on us, so If the test fails there, then I setup anyway*

This sets the proper images, downloads the required secrets, and creates a
`docker-compose.yaml` file that is ready to deploy.  The `docker-compose.yaml` has
all the default parameters, so you shouldn't need a `.env` file, unless you are
doing something out of the ordinary.

## Harvest New Data

Now we are ready to harvest new data. For this we need to run a harvest process
on the ~fuseki~ container.  Right now, the ~fuseki~ container is *only* used for
harvesting new data.  In addition to the documentation below, a
[Screencast](https://drive.google.com/file/d/1Cyh7jxfiFdXu_wSHGAZ440YZJ9Um6IQ-/view)
of the process is also available.

Above, we mentioned there is an exception to the rule that no other containers
are running on our server.  Occasionally, you may want to harvest new data on a
`blue|gold` server, while you are still running a different instance of Aggie
Experts.  There is no problem doing this, and if you *only* start the `fuseki`
instance, then you don't have to worry about sharing any ports either.  In this
example, we'll start fuseki only

``` bash
dc up -d fuseki
```

*Note: this following step is run by hand, and still requires a certain amount
 of monitoring.  This is mostly due to the fact that running docker containers
 on the Library's VM cluster can sometimes be problematic, and not allocate the
 memory the container expects.  This will cause fuseki's Java to crash, and
 kills the container as well.*

I typically use `byobu` so that I can open multiple terminals on the system, but
I can also disconnect.  This is important because importing the data can take
quite awhile.

``` bash
byobu
```

Next, we want to run a bash instance on fuseki. Rather than using a simple
`bash` execution, we start via the normal Dockerfile ENTRYPOINT.  Unlike most
images, fuseki runs as it's own process user, and this method uses the same
user.

``` bash
docker compose exec fuseki bash
```

This brings you to a bash shell on the fuseki container, where you should see a
prompt similiar to: `ucd.process@4cdbbe11f9ef:~$`

Now, let's fetch all the experts.

```bash
experts cdl --log=info --groups=experts
```

This starts the harvest in the foreground and logs to the console as it works.
The information includes downloading XML data from CDL, creating a new database,
running SPARQL commands on the database, and finalizing the expert.  As it runs,
it fills up the `cache` directory with: The files downloaded; the SPARQL
commands run, and the fcrepo representation of the expert.

You can open another byobu terminal to monitor the cache being built by the
harvest.

``` bash
docker compose exec fuseki bash
ls cache/     # will list expert directories
ls cache/ | wc -l # count of experts harvested to monitor progress.
```

Now, you can log out, and the harvest will still be running. Later you can ssh
back into the server and restart byobu to continue.

As discussed above, while running a long import, you're fuseki container my
crash.  You can look at the docker logs to see why the container crashed.  In
addition, after restarting and bashing back into the system.  You can see the
application log in the ~/home/ucd.process~ directory for when the application
failed.

You can restart the process where you left off with the `--skip-existing`
flag. This will *not* reprocess any experts currently in the cache.

``` bash
docker compose exec fuseki bash
rm databases/* config/*  # If fuseki fails in a bad spot, the last user might have corrupted data.
experts cdl --log=info --skip-existing --groups=experts
```

## Import the data

Once you have a cache of data ready, we can import that into the new instance.
At this point it *is* important that no other conflicting containers are running
on the computer.  *PRO NOTE: you can also do this using ???_PORT variables in the .env file*

Startup the complete instance:

```bash
docker compose up -d
```

This should *not* start the gateway until all initialization steps are complete. Check
the docker logs to ensure that the entire instance started properly. 

Now you can import the data:

```bash
dc exec fuseki experts_import
```

You can monitor progress through the `/fin/admin` section of your new
`stage.experts.library.ucdavis.edu`

## Update the Summary Spreadsheet

To monitor changes in the experts, grants and works on the app, an internal Aggie Experts 
Summary spreadsheet is updated with the imported data. To do so, first download the data 
onto a csv using:

```bash
bin/count-experts --host=https://stage.experts.library.ucdavis.edu
```

This command will save the csv at `~/aggie-experts/log/YYYYMMDD` by default. Next, import 
the csv to the Aggie Experts Summary spreadsheet. One way to do this is to go to File > Import, 
then use the Upload tab on the right; select `Insert new sheet(s)` from the `Import location` 
dropdown on the `Import file` dialogue box.

Rename the sheet with the download date, formatted as YYYYMMDD. Now, update the formula in 
cell A2 on the `combined` sheet to include this newest data, replacing the oldest data in
the formula. Next, copy all of column A on the `combined` sheet and `Paste special > Values only` 
into column A on the `delta` sheet, replacing the experts column on that sheet. Finally, update
the sheet names in cells D2, E2, and F2 of the `delta` sheet to include the newest data, ordering
them to have newer data on the left.

You should now be able to sort the data as desired. (Note: sorting will only work properly
if the experts column was pasted in the delta using `Paste special > Values only`; a 
normal paste will not allow for proper sorting.)


## Test the server

Once you see that all the data has been processed by fin, invite your
collaborators to test the system now running at
`stage.experts.library.ucdavis.edu`.  If bugs are encountered, for example UI
bugs, then once those bugs are fixed, you can use `git pull` on your directory,
`git checkout 4.0.3` or whatever the newly built images are, and then `dc pull`
followed by `dc up -d` to create new containers based on the new images, where
they have changed.  The data stays the same.

## Deploy to production

Once acceptance testing is complete, you promote this instance to the new version.

``` bash
cd /etc/aggie-experts/4-1
bin/aggie-experts --no-gcs --no-test --env=prod setup
dc pull; dc down; dc up -d
```

And you can now test it's working.  At this point both blue and gold are both
running a production system, and being balanced by the router.  You can test
by removing your cookies from your browser at `https://experts.ucdavis.edu` and reloading until you see your new version come up.  If everything looks good,  then you can stop the previous version.  Let's assume that's on gold. then:

```bash
ssh gold.experts.library.ucdavis.edu
cd /etc/aggie-experts/4-0  # or whatever the running version is
dc stop
```

I usually just stop these so they can be started quickly if we need to revert.

## Clean-up: Deleting old instances

Currently, weekly snapshots of Aggie Experts are created, resulting in a number of defunct ones lying about in `file://[blue|gold].experts.library.ucdavis.edu/etc/aggie-experts`. Prevous versions are useful to go back in time, and map harvesting in particular, which can be done without bringing up the whole system.

Typically, 3 or 4 previous versions are kept. Removing an older version takes hours, consequently:
  - remove instances while that machine [blue|gold] is still serving stage; deleting the old versions can slow down disk access (elasticsearch) on the server
  - don't remove an instance while you are harvesting for another; both tasks are disk intensive
  - use `byobu` or similar to avoid interruption

The process is
  ```bash
  ver=3-2
  cd /etc/aggie-experts/$ver
  dc down -v
  cd ..
  rm -rf $ver
  ``` 
  
If the deletion process does get interrupted, docker can appear slow, with no good indication of what's going on. Rather than restarting the docker daemon, which won't solve the problem, monitor that the deletion is still happening in the background, and wait for it to end. The problem is always fcrepo, and it's millions of files. Track the deletion of a volume like this:

```bash
ver=3-2
sudo ls /var/lib/docker/volumes/${ver}_fedora-data/_data/ocfl-root/ | wc -l
```

This lists the file roots in fcrepo's filestore, which is stored in a tree. If the deletion is still going on, you will see this number slowly decrease. If you do see that, then just monitor and wait for that to complete. Sometimes, depending on how you got into trouble, you may have to rerun `dc down -v` but it'll go fast after fcrepo is gone.
