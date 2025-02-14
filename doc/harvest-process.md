## The CDL Harvest Process

The NodeJS command-line script, [experts-cdl](../harvest/experts-client/bin/experts-cdl.js) obtains a list of users and uses the [Symplectic API](https://support.symplectic.co.uk/support/solutions/folders/6000177986) to retreive the expert's profile and related publications and grants from the [CDL](https://cdlib.org/) Elements instance. The list of users can be provided as a simple list of IDs or as a list of CDL group IDs. Note: CDL maintains a researcher group hierarcy managed on their Symplectic [Elements instance](https://oapolicy.universityofcalifornia.edu/).

For example, this call of the script would retrieve the list of user IDs in group 1587 (the sandbox set of 175 users used for testing) and then fetch the users and their related objects individually.

`harvest/experts-client/bin/experts cdl --groups=1587`

Where as,
`harvest/experts-client/bin/experts cdl quinn,jrmerz`
would harvest just the two specified researchers.


The steps for each user are:
1. Fetch the XML representation of the user and their related objects
2. Tranform the XML to [JSON-LD](https://json-ld.org/) and load into a local Fuseki instance
3. Transform the resultant dataset to the [VIVO Ontology](https://github.com/vivo-ontologies/vivo-ontology?tab=readme-ov-file) format by using a [SPARQL](https://www.w3.org/TR/sparql11-query/) construct query designed for this purpose.
4. Write the transformed JSON-LD to a local file cache   

The node class files [cdl-client](../harvest/experts-client/lib/cdl-client.js), , [fuseki-client](../harvest/experts-client/lib/fuseki-client.js), [iam-client](../harvest/experts-client/lib/iam-client.js) and [cache](../harvest/experts-client/lib/cache) are used to accomplish these tasks.

