const router = require('express').Router();
const { user_can_edit } = require('../middleware/index.js')
const BaseModel = require('../base/model.js');

router.route(
    '/es/indexes'
).get(
    user_can_edit,
    async (req, res) => {
        try {
            const model = new BaseModel();
            const indexes = await model.getAvailableIndexes();
            const aliases = await model.getAvailableAliases();

            // combine indexes and aliases info
            const result = {};
            for (const indexName in indexes) {
                result[indexName] = {
                    index: indexes[indexName],
                    aliases: aliases[indexName] ? Object.keys(aliases[indexName].aliases) : []
                };
            }

            res.status(200).json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
).post( 
    user_can_edit,
    async (req, res) => {
        try {
            const model = new BaseModel();
            let esClient = model.client;

            let indexesToSwitch = req.body.indexesToSwitch;
            if( !indexesToSwitch || !Array.isArray(indexesToSwitch) ) {
                return res.status(400).json({ error: 'indexesToSwitch is required and should be an array' });
            }

            for( const { indexName: index, aliasName: alias } of indexesToSwitch ) {
                const aliasExists = await esClient.indices.existsAlias({ name: alias });
                let alreadySet = false;

                if( aliasExists ) {
                    const currentAliases = await esClient.indices.getAlias({ name: alias });
                    const currentIndexes = Object.keys(currentAliases);
                    for( const currentIndex of currentIndexes ) {
                        if( currentIndex === index ) {
                            alreadySet = true;
                            continue;
                        }

                        console.log(`Removing alias ${alias} from index ${currentIndex}`);
                        await esClient.indices.deleteAlias({ index: currentIndex, name: alias });
                    }
                }

                if( alreadySet ) {
                    console.log(`Alias ${alias} is already set to index ${index}, no changes made.`);
                    continue;
                }

                console.log(`Adding alias ${alias} to index ${index}`);
                await esClient.indices.putAlias({ index: index, name: alias });
            }
           
            res.status(200).json({ 
                message: `Updated aliases successfully`, 
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
).delete(
    user_can_edit,
    async (req, res) => {
        try {
            const model = new BaseModel();
            let esClient = model.client;

            let indexesToDelete = req.body.indexesToDelete;
            if( !indexesToDelete || !Array.isArray(indexesToDelete) ) {
                return res.status(400).json({ error: 'indexesToDelete is required and should be an array' });
            }

            for( const index of indexesToDelete ) {
                const indexExists = await esClient.indices.exists({ index });
                if( !indexExists ) {
                    console.log(`Index ${index} does not exist, skipping deletion.`);
                    continue;
                }

                console.log(`Deleting index: ${index}`);
                await esClient.indices.delete({ index });
            }
            
            res.status(200).json({ 
                message: `Deleted indexes ${indexesToDelete.join(', ')} successfully` 
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
);

module.exports = router;
