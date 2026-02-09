const router = require('express').Router();
const { /*openapi,*/ user_can_edit } = require('../middleware/index.js')
const BaseModel = require('../base/model.js');

router.route(
    '/es/indexes'
).get(
    // user_can_edit,
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
        // if admin and want to set alias to point to different index
        // check cookies for elasticIndex and update model accordingly
        res.status(501).json({ error: 'Not implemented yet' });
 
        // also model.setReadWriteIndexes() is just alias, need to update indexes the aliases point to too? not sure
        // try {
        //     const { indexName, aliasName } = req.body;
        //     if (!indexName || !aliasName) {
        //         return res.status(400).json({ error: 'indexName and aliasName are required' });
        //     }
        //     const model = new BaseModel();
        //     await model.setAlias(indexName, aliasName);
        //     res.status(200).json({ message: `Alias ${aliasName} set to index ${indexName}` });
        // } catch (e) {
        //     res.status(500).json({ error: e.message });
        // }
    }
)

module.exports = router;
