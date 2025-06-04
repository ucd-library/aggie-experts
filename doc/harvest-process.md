## The CDL Harvest Process

The NodeJS command-line(CLI) script, [experts-cdl](../harvest/experts-client/bin/experts-cdl.js) obtains a list of users and uses the [Symplectic API](https://support.symplectic.co.uk/support/solutions/folders/6000177986) to retreive the expert's profile, related publications, and grants from the [CDL](https://cdlib.org/) Elements instance. The list of users can be provided as a simple list of IDs or as a list of CDL group IDs. Note: CDL maintains a researcher group hierarcy managed on their Symplectic [Elements instance](https://oapolicy.universityofcalifornia.edu/).

### Aggie Experts CLI Scripts
The experts-cdl script is executed from the command-line and uses the [Commander Node Module](https://www.npmjs.com/package/commander) for this purpose. This module allows Node JS files be used in the same way as system utilities like git, ls, grep, and so on. It makes it easy to define and validate parameters and to call processes from other scripts in a non-graphical environment.

The [Harvest Dockerfile](../harvest/Dockerfile) deploys harvest related CLI scripts to the `/usr/local/lib/` directory of the target instance so that they become command line utilities available to local users.

For example,

`experts cdl --groups=1587`

... would retrieve the list of user IDs in group 1587 (the sandbox set of 175 users used for testing) and then fetch the users and their related objects individually.

Where as,

`experts cdl quinn,jrmerz`

... would harvest just the two specified researchers. The script supports other parameters and options which are documented in the source code.


The experts cdl script performs the following steps for each user:
1. Fetch the XML representation of the user and their related objects
2. Tranform the XML to [JSON-LD](https://json-ld.org/) and load into a local Fuseki instance
3. Transform the resultant dataset to the [VIVO Ontology](https://github.com/vivo-ontologies/vivo-ontology?tab=readme-ov-file) format by using a [SPARQL](https://www.w3.org/TR/sparql11-query/) construct query designed for this purpose.
4. Write the transformed JSON-LD to local directory `cache` 
  
### Importing Objects to Fin

The resulting `cache` directory contains a subdirectory for each expert harvested. Within each further subdirectories contain JSON-LD formatted files representing the expert profile, works, and grants. 

An import script can then use the `fin io` utility to import these data objects into FIN (`fcrepo`) 

With the JSON imported into FIN, it is synchronized with Elastic Search indexes and becomes available to other applications via the Aggie Experts API. 

For a detailed step-by-step on performing a code deployment and data harvest see: [The CDL Harvest Process](./experts-deploy-harvest.md)


