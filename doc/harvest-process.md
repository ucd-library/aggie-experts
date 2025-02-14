## The CDL Harvest Process

The NodeJS command-line script, [experts-cdl](../harvest/experts-client/bin/experts-cdl.js) obtains a list of users and uses the Symplectic API to retreive the expert's profile and related publications and grants from the CDL Elements instance. The list of users can be provided as a simple list of IDs or as a list of CDL group IDs. Note: CDL maintains a researcher group hierarcy managed on their Symplectic [Elements instance](https://oapolicy.universityofcalifornia.edu/).

For example, this call of the script would retrieve the list of user IDs in group 1587 (the sandbox set of 175 users used for testing) and the fetch the users and their related objects individually.

`harvest/experts-client/bin/experts cdl --groups=1587`

Where as,
`harvest/experts-client/bin/experts cdl quinn,jrmerz`
would harvest just the two specified researchers.


The steps for each user are:
1. Fetch the XML representation of user and their related objects
2. Tranform the XML to JSON-LD and load into a local Fuseki instance
3. Transform the resultant dataset to the VIVO Ontology format by using a Sparkle construct query designed for this purpose.
4. Write the transformed JSON-LD to a local file cache   

The the node class files [cdl-client](../harvest/experts-client/lib/cdl-client.js), [cache](../harvest/experts-client/lib/cache), [fuseki-client](../harvest/experts-client/lib/fuseki-client.js), and [iam-client](../harvest/experts-client/lib/iam-client.js) to accomplish these tasks.

