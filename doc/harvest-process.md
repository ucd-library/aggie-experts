## The CDL Harvest Process

The NodeJS script [experts-cdl](../harvest/experts-client/bin/experts-cdl.js) obtains a list of users and uses the Symplectic API to retreive the expert's profile and related publications and grants from the CDL Elements instance.

The steps for each user are:
1. Fetch the XML representation of user and their related objects
2. Tranform the XML to JSON-LD and load into a local Fuseki instance
3. Transform the resultant dataset to the VIVO Ontology format by using a Sparkle construct query designed for this purpose.
4. Write the transformed JSON-LD to a local file cache   

The script uses the [cdl-client](../harvest/experts-client/lib/cdl-client.js), [cache](../harvest/experts-client/lib/cache), [fuseki](../harvest/experts-client/lib/fuseki-client.js), and [iam-client](../harvest/experts-client/lib/iam-client.js) to accomplish these tasks.

