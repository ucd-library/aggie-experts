const router = require('express').Router();
const { user_can_edit, public_or_is_user } = require('../middleware/index.js')
const BaseModel = require('../base/model.js');
const { config } = require('@ucd-lib/experts-commons');

const PUBLIC_INDEX_TYPES = ['experts', 'works', 'grants'];

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

router.route(
    '/es/public-index/:type'
).get(
    public_or_is_user,
    async (req, res) => {
        try {
            const type = req.params.type;
            if( !PUBLIC_INDEX_TYPES.includes(type) ) {
                return res.status(400).json({ error: `type must be one of: ${PUBLIC_INDEX_TYPES.join(', ')}` });
            }

            const model = new BaseModel();
            const aliasName = `${type}-${config.elasticsearch.aliases.current}`;
            const aliases = await model.getAvailableAliases();
            const indexName = Object.keys(aliases).find(name => aliases[name]?.aliases?.[aliasName]) || null;

            res.status(200).json({ indexName });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
);

module.exports = router;
