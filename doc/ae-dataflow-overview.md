![Overview of the Aggie Experts Dataflow](AE-DataFlow.jpg)

- CDL - The California Digital Library hosts an instance of [Symplectic Elements](https://www.symplectic.co.uk/theelementsplatform/)
- Harvest - AE uses the [Harvest process](experts-deploy-harvest.md) to pull researchers, publications, and grants from the CDL using the Symplectic API
- LDP - AE stores data in a [Fedora](https://wiki.lyrasis.org/display/FF/Fedora+Repository+Home) Linked Data Platform
- ES - AE uses [Elastic Search](https://www.elastic.co/elasticsearch) to support query and presentation of experts, works, and grants.  
- Feed Processor 
- Grant Processor
- APIs & Web Services
- Aggie Enterprise
- IAM
- Department Websites
- MyInfoVault
