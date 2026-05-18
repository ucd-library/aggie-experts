import ElementsClient from './elements-client.js';

function getRelatesId(rel) {
	if (typeof rel === 'string') {
		return rel;
	}
	if (rel && typeof rel === 'object' && typeof rel['@id'] === 'string') {
		return rel['@id'];
	}
	return null;
}

function normalizeRelates(relates) {
	const list = Array.isArray(relates) ? relates : [relates];
	const result = [];
	const seen = new Set();

	for (const rel of list) {
		const id = getRelatesId(rel);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		result.push(id);
	}

	return result;
}

function findRelatedByRoleIndex(relatedBy = [], rid) {
	if (!rid) {
		return -1;
	}

	return relatedBy.findIndex(r => r?.['@id'] === rid);
}

function mutateRoleForActor(role, patch, expertId) {
	if (!role) {
		return;
	}

	const relates = normalizeRelates(role.relates);
	const nonExpertRelates = relates.filter(rel => !rel.startsWith('expert/'));

	// Keep this role actor-scoped to avoid cross-expert side effects and duplicates.
	role.relates = [...nonExpertRelates, expertId];

	if (patch.visible != null) {
		role['is-visible'] = patch.visible === true;
	}

	if (patch.favourite != null) {
		role['ucdlib:favourite'] = patch.favourite;
	}
}

function removeActorFromRole(role, expertId) {
	if (!role) {
		return;
	}

	const relates = normalizeRelates(role.relates);
	role.relates = relates.filter(rel => rel !== expertId);

	// If a malformed role no longer relates to any expert, keep it hidden.
	const hasAnyExpert = role.relates.some(rel => typeof rel === 'string' && rel.startsWith('expert/'));
	if (!hasAnyExpert) {
		role['is-visible'] = false;
	}
}

function getRelatesExpertIds(rel) {
	const relates = Array.isArray(rel?.relates) ? rel.relates : [rel?.relates];
	const ids = [];

	for (const r of relates) {
		const id = typeof r === 'string' ? r : r?.['@id'];
		if (typeof id === 'string' && id.startsWith('expert/')) {
			ids.push(id);
		}
	}

	return ids;
}

function getNodeByRelatedId(doc, id) {
	const nodes = [];
	for (let i = 0; i < doc['@graph'].length; i++) {
		if (Array.isArray(doc['@graph'][i]?.relatedBy)) {
			for (let k = 0; k < doc['@graph'][i].relatedBy.length; k++) {
				if (doc['@graph'][i].relatedBy[k]['@id'] === id) {
					nodes.push(doc['@graph'][i]);
					continue;
				}
			}
		} else if (doc['@graph'][i]?.relatedBy?.['@id'] === id) {
			nodes.push(doc['@graph'][i]);
		}
	}

	if (nodes.length === 0) {
		throw new Error(`Unable to find node with relatedBy{"@id"="${id}"}`);
	}
	if (nodes.length > 1) {
		throw new Error(`Found multiple nodes with relatedBy{"@id"="${id}"}`);
	}

	return nodes[0];
}

function getExpectedModelNode(doc) {
	if (!Array.isArray(doc?.['@graph'])) {
		throw new Error(`Invalid document ${doc?.['@id'] || 'unknown'}: missing @graph array`);
	}

	const nodes = doc['@graph'].filter(n => n?.['@id'] === doc['@id']);
	if (nodes.length === 0) {
		throw new Error(`Unable to find root node for ${doc['@id']}`);
	}
	if (nodes.length > 1) {
		throw new Error(`Found multiple root nodes for ${doc['@id']}`);
	}

	return nodes[0];
}

function expertSnippet(node) {
	const fields = ['@id', '@type', 'identifier', 'orcidId', 'name', 'contactInfo', 'is-visible'];

	if (node.contactInfo) {
		if (!Array.isArray(node.contactInfo)) {
			node.contactInfo = [node.contactInfo];
		}
		const best = node.contactInfo.sort((a, b) => (a.rank || 100) - (b.rank || 100))[0];
		['hasOrganizationalUnit', 'hasTitle', 'hasURL', 'rank'].forEach(x => delete best[x]);
		node.contactInfo = [best];
	}

	const out = {};
	fields.forEach(key => {
		if (node[key]) out[key] = node[key];
	});

	return out;
}

function getExpertAlias(config) {
	return 'experts-' + config.elasticsearch.aliases.current;
}

async function getExpertDocument(expertModel, expertId, config) {
	const resp = await expertModel.client.get({
		index: getExpertAlias(config),
		id: expertId,
		_source: true
	});
	return resp?._source;
}

async function updateGraphNode(expertModel, documentId, nodeToUpdate, alias) {
	return expertModel.client.update({
		index: alias,
		id: documentId,
		retry_on_conflict: expertModel.UPDATE_RETRY_COUNT || 3,
		script: {
			source: `
  ctx._source['@graph'].removeIf((Map item) -> { item['@id'] == params.node['@id'] });
  ctx._source['@graph'].add(params.node);`,
			params: { node: nodeToUpdate }
		}
	});
}

async function deleteGraphNode(expertModel, documentId, nodeToDelete, alias) {
	return expertModel.client.update({
		index: alias,
		id: documentId,
		retry_on_conflict: expertModel.UPDATE_RETRY_COUNT || 3,
		script: {
			source: `
   ctx._source['@graph'].removeIf((Map item) -> { item['@id'] == params.node['@id'] });`,
			params: { node: nodeToDelete }
		}
	});
}

async function impersonateCdlUser(expert, args) {
	let rootNode = getExpectedModelNode(expert);
	if (!Array.isArray(rootNode.identifier)) {
		rootNode.identifier = [rootNode.identifier];
	}

	let cdlUserId;
	for (let i = 0; i < rootNode.identifier.length; i++) {
		if (rootNode.identifier[i].startsWith('ark:/87287/d7mh2m/user/')) {
			cdlUserId = rootNode.identifier[i].replace('ark:/87287/d7mh2m/user/', '');
			break;
		}
	}

	if (cdlUserId == null) {
		throw new Error(`Unable to find CDL user id for ${expert['@id']}`);
	}

	return ElementsClient.impersonate(cdlUserId, args);
}

async function patchExpertEsVisibility({ expertModel, patch, expertId, logger, config }) {
	let expert;

	logger.info(patch, `expert.patch(${expertId})`);
	if (patch.visible == null) {
		throw new Error('Invalid patch, visible is required');
	}

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
	} catch (e) {
		e.message = `expert "@id"=${expertId} not found`;
		e.status = 500;
		throw e;
	}

	expert['is-visible'] = patch.visible;

	// update both public/latest aliases to keep them in sync
	await expertModel.client.index({
		index: 'experts-' + config.elasticsearch.aliases.stage,
		id: expert['@id'],
		document: expert
	});
	await expertModel.client.index({
		index: 'experts-' + config.elasticsearch.aliases.current,
		id: expert['@id'],
		document: expert
	});
}

async function patchExpertCdlVisibility({ expertModel, patch, expertId, logger, config }) {
	let expert;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
	} catch (e) {
		e.message = `expert "@id"=${expertId} not found`;
		e.status = 500;
		throw e;
	}

	const cdlUser = await impersonateCdlUser(expert, config.experts.cdl.expert);
	const resp = await cdlUser.updateUserPrivacyLevel({ privacy: patch.visible ? 'public' : 'internal' });
	logger.info({ cdl_response: resp }, `CDL expert visibility update`);
}

async function patchExpertVisibility({ expertModel, patch, expertId, logger, config }) {
	return patchExpertEsVisibility({ expertModel, patch, expertId, logger, config });
}

async function deleteExpert({ expertModel, expertId, logger, config }) {
	logger.info(`expert.delete(${expertId})`);

	// Delete Elasticsearch document
	let expert;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
	} catch (e) {
		logger.info(`expert @id ${expertId} not found`);
		return 404;
	}

	// update both public/latest aliases to keep them in sync
	try {
		await expertModel.client.delete({
			id: expertId,
			index: 'experts-' + config.elasticsearch.aliases.stage
		});

		// if stage/current point to the same index, could fail in second delete
		await expertModel.client.delete({
			id: expertId,
			index: 'experts-' + config.elasticsearch.aliases.current
		});
	} catch (e) {
		logger.warn({
			expertId,
			index: 'experts-' + config.elasticsearch.aliases.current,
			error: e.message
		}, 'expert.delete second alias delete failed; continuing');
	}

	// also update any visible works/grants for this expert
	const visibleWorks = [];
	const visibleGrants = [];
	for (const node of expert['@graph']) {
		if (node['@type'].includes('Work')) {
			const related = node.relatedBy?.find(r => r?.relates?.includes(expertId) && r['is-visible']);
			if (related && related['@id']) {
				visibleWorks.push({
					id: node['@id'],
					relationshipId: related['@id']
				});
			}
		} else if (node['@type'].includes('Grant')) {
			const related = node.relatedBy?.find(r => r?.relates?.includes(expertId) && r['is-visible']);
			if (related && related['@id']) {
				visibleGrants.push({
					id: node['@id'],
					relationshipId: related['@id']
				});
			}
		}
	}

	for (const work of visibleWorks) {
		await patchWorkDocumentVisibility({
			expertModel,
			workId: work.id,
			patch: { visible: false },
			rid: work.relationshipId,
			expertId,
			expertDoc: expert,
			logger,
			config
		});
	}

	for (const grant of visibleGrants) {
		await patchGrantRoleVisibility({
			expertModel,
			grantId: grant.id,
			patch: { visible: false },
			rid: grant.relationshipId,
			expertId,
			logger,
			config
		});
	}

	if (config.experts.cdl.expert.propagate) {
		const cdlUser = await impersonateCdlUser(expert, config.experts.cdl.expert);
		const resp = await cdlUser.updateUserPrivacyLevel({
			privacy: 'internal'
		});
		logger.info({ cdl_response: resp }, `CDL propagate privacy ${config.experts.cdl.expert.propagate}`);
	} else {
		logger.info({ cdl_response: null }, `CDL propagate changes ${config.experts.cdl.expert.propagate}`);
	}
}

async function patchExpertAvailability({ expertModel, data, expertId, logger, config }) {
	let expert;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
	} catch (e) {
		logger.info(`expert @id ${expertId} not found`);
		return 404;
	}

	if (expert.hasAvailability) delete expert.hasAvailability;
	expert['@graph'].forEach(n => {
		if (n['@id'] === expertId && n.hasAvailability) {
			delete n.hasAvailability;
		}
	});

	// build availability nodes
	if (data.currentLabels.length > 0) {
		const hasAvailability = data.currentLabels.map(label => ({
			'@id': `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(label)}`,
			'@type': 'Concept',
			prefLabel: label,
			'skos:inScheme': {
				'@id': 'ark:/87287/d7mh2m/keyword/c-ucd-avail/'
			},
			availabilityOf: expertId
		}));

		expert.hasAvailability = hasAvailability;
		expert['@graph'].forEach(n => {
			if (n['@id'] === expertId) {
				n.hasAvailability = hasAvailability;
			}
		});
	}

	// update both public/latest aliases to keep them in sync
	await expertModel.client.index({
		index: 'experts-' + config.elasticsearch.aliases.stage,
		id: expert['@id'],
		document: expert
	});
	await expertModel.client.index({
		index: 'experts-' + config.elasticsearch.aliases.current,
		id: expert['@id'],
		document: expert
	});

	// update cdl
	if (config.experts.cdl.expert.propagate) {
		const cdlUser = await impersonateCdlUser(expert, config.experts.cdl.expert);
		const resp = await cdlUser.updateUserAvailabilityLabels({
			labelsToAddOrEdit: data.labelsToAddOrEdit,
			labelsToRemove: data.labelsToRemove
		});
		logger.info({ cdl_response: resp }, `CDL propagate privacy ${config.experts.cdl.expert.propagate}`);
	} else {
		logger.info({ cdl_response: null }, `CDL propagate changes ${config.experts.cdl.expert.propagate}`);
	}
}

async function patchGrantRoleVisibility({ expertModel, grantId, patch, rid, expertId, logger, config }) {
	const grantAliases = [
		'grants-' + config.elasticsearch.aliases.stage,
		'grants-' + config.elasticsearch.aliases.current
	];

	for (const index of grantAliases) {
		let grantDocResp;
		try {
			grantDocResp = await expertModel.client.get({
				index,
				id: grantId,
				_source: true
			});
		} catch (e) {
			logger.info({ grantId, index, error: e.message }, 'expert.patchGrantDocument grant document not found');
			continue;
		}

		const grantDoc = grantDocResp?._source;
		if (!grantDoc || !Array.isArray(grantDoc['@graph'])) continue;

		const rootNode = grantDoc['@graph'].find(n => n && n['@id'] === grantDoc['@id']);
		if (!rootNode) continue;

		if (!Array.isArray(rootNode.relatedBy)) {
			rootNode.relatedBy = rootNode.relatedBy ? [rootNode.relatedBy] : [];
		}

		const roleIndex = rootNode.relatedBy.findIndex(rel => {
			if (rid && rel?.['@id'] === rid) return true;
			return rel?.inheres_in === expertId;
		});

		if (roleIndex === -1) {
			logger.info({ grantId, index, rid, expertId }, 'expert.patchGrantDocument no matching relatedBy role');
			continue;
		}

		if (patch.visible != null) {
			rootNode.relatedBy[roleIndex]['is-visible'] = patch.visible === true;

			// keep expert snippet nodes in sync with root relatedBy visibility
			const expertVisibility = new Map();
			for (const rel of rootNode.relatedBy) {
				const expertIds = new Set(getRelatesExpertIds(rel));
				if (typeof rel?.inheres_in === 'string' && rel.inheres_in.startsWith('expert/')) {
					expertIds.add(rel.inheres_in);
				}

				for (const id of expertIds) {
					const currentlyVisible = expertVisibility.get(id) === true;
					const roleVisible = rel?.['is-visible'] === true;
					expertVisibility.set(id, currentlyVisible || roleVisible);
				}
			}

			for (const graphNode of grantDoc['@graph']) {
				const graphNodeId = graphNode?.['@id'];
				if (graphNodeId === grantDoc['@id']) continue;
				if (typeof graphNodeId !== 'string' || !graphNodeId.startsWith('expert/')) continue;
				graphNode['is-visible'] = expertVisibility.get(graphNodeId) === true;
			}

			// keep any related expert docs in sync for this grant role visibility
			const relatedExpertIds = new Set();
			for (const rel of rootNode.relatedBy) {
				const expertIds = new Set(getRelatesExpertIds(rel));
				if (typeof rel?.inheres_in === 'string' && rel.inheres_in.startsWith('expert/')) {
					expertIds.add(rel.inheres_in);
				}

				for (const relExpertId of expertIds) {
					if (relExpertId !== expertId) {
						relatedExpertIds.add(relExpertId);
					}
				}
			}

			const expertIndex = index.includes(config.elasticsearch.aliases.stage)
				? 'experts-' + config.elasticsearch.aliases.stage
				: 'experts-' + config.elasticsearch.aliases.current;

			for (const relatedExpertId of relatedExpertIds) {
				let relatedExpertResp;
				try {
					relatedExpertResp = await expertModel.client.get({
						index: expertIndex,
						id: relatedExpertId,
						_source: true
					});
				} catch (e) {
					logger.info({ grantId, index: expertIndex, relatedExpertId, error: e.message }, 'expert.patchGrantDocument related expert not found');
					continue;
				}

				const relatedExpertDoc = relatedExpertResp?._source;
				if (!relatedExpertDoc || !Array.isArray(relatedExpertDoc['@graph'])) continue;

				const relatedGrantNode = relatedExpertDoc['@graph'].find(n => n && n['@id'] === grantDoc['@id']);
				if (!relatedGrantNode) continue;

				if (!Array.isArray(relatedGrantNode.relatedBy)) {
					relatedGrantNode.relatedBy = relatedGrantNode.relatedBy ? [relatedGrantNode.relatedBy] : [];
				}

				// Keep embedded grant nodes actor-scoped in expert docs to avoid cross-expert leakage in search.
				const actorRoleIndex = relatedGrantNode.relatedBy.findIndex(rel => {
					const roleExpertIds = new Set(getRelatesExpertIds(rel));
					if (typeof rel?.inheres_in === 'string' && rel.inheres_in.startsWith('expert/')) {
						roleExpertIds.add(rel.inheres_in);
					}
					return roleExpertIds.has(relatedExpertId);
				});

				if (actorRoleIndex === -1) continue;

				const actorRole = relatedGrantNode.relatedBy[actorRoleIndex];
				relatedGrantNode.relatedBy.forEach(rel => {
					if (rel === actorRole) {
						rel['is-visible'] = actorRole?.['is-visible'] === true;
					}
				});
				relatedGrantNode['is-visible'] = actorRole?.['is-visible'] === true;

				await expertModel.client.index({
					index: expertIndex,
					id: relatedExpertDoc['@id'],
					document: relatedExpertDoc,
					if_seq_no: relatedExpertResp._seq_no,
					if_primary_term: relatedExpertResp._primary_term,
					refresh: 'wait_for'
				});
			}
		}

		grantDoc['is-visible'] = rootNode.relatedBy.some(rel => rel?.['is-visible'] === true);

		await expertModel.client.index({
			index,
			id: grantDoc['@id'],
			document: grantDoc,
			if_seq_no: grantDocResp._seq_no,
			if_primary_term: grantDocResp._primary_term,
			refresh: 'wait_for'
		});
	}
}

async function patchGrantEsVisibility({ expertModel, patch, expertId, logger, config }) {
	const id = patch['@id'];
	let expert;
	let node;

	logger.info({ expert: expertId, patch }, `expert.grantRole.patch(${expertId})`);
	if (patch.visible == null && patch.favourite == null) {
		return 400;
	}

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
		node = getNodeByRelatedId(expert, id);
	} catch (e) {
		e.message = `relatedBy[${id}] not found in expert ${expertId}: ${e.message}`;
		e.status = 500;
		throw e;
	}

	const roleIndex = node.relatedBy.findIndex(r => r['@id'] === id);
	if (roleIndex === -1) {
		throw {
			status: 500,
			message: `Role ${id} not found in grant relatedBy array`
		};
	}

	if (patch.visible != null) {
		node.relatedBy[roleIndex]['is-visible'] = patch.visible;
		node['is-visible'] = patch.visible === true;
	}

	// update both public/latest to keep them in sync
	await updateGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.stage);
	await updateGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.current);

	await patchGrantRoleVisibility({
		expertModel,
		grantId: node['@id'],
		patch,
		rid: id,
		expertId,
		logger,
		config
	});
}

async function patchGrantCdlVisibility({ expertModel, patch, expertId, logger, config }) {
	const id = patch['@id'];
	let expert;
	let node;
	let resp;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
		node = getNodeByRelatedId(expert, id);

		if (!patch.objectId) {
			if (typeof node?.identifier === 'string') {
				node.identifier = [node.identifier];
			}
			for (let i = 0; i < node?.identifier?.length; i++) {
				if (node.identifier[i].startsWith('ark:/87287/d7mh2m/')) {
					patch.objectId = node.identifier[i].replace('ark:/87287/d7mh2m/', '');
					break;
				}
			}
			if (!patch.objectId) {
				throw {
					status: 500,
					message: `CDL identifier not found in expert ${expertId}`
				};
			}
		}
	} catch (e) {
		e.message = `relatedBy[${id}] not found in expert ${expertId}: ${e.message}`;
		e.status = e.status || 500;
		throw e;
	}

	const cdl_user = await impersonateCdlUser(expert, config.experts.cdl.grant_role);

	if (patch.visible != null) {
		resp = await cdl_user.setLinkPrivacy({
			objectId: patch.objectId,
			categoryId: 2,
			privacy: patch.visible ? 'public' : 'internal'
		});
		logger.info({ cdl_response: resp }, `CDL propagate privacy ${config.experts.cdl.grant_role.propagate}`);
	}
	if (patch.favourite != null) {
		patch.categoryId = 2;
		resp = await cdl_user.setFavourite(patch);
		logger.info({ cdl_response: resp }, `CDL propagate favourite ${config.experts.cdl.grant_role.propagate}`);
	}
}

async function patchGrantVisibility({ expertModel, patch, expertId, logger, config }) {
	await patchGrantEsVisibility({ expertModel, patch, expertId, logger, config });
	if (config.experts.cdl.grant_role.propagate) {
		await patchGrantCdlVisibility({ expertModel, patch, expertId, logger, config });
	} else {
		logger.info({ cdl_response: null }, `CDL propagate changes ${config.experts.cdl.grant_role.propagate}`);
	}
}

async function patchWorkDocumentVisibility({ expertModel, workId, patch, rid, expertId, expertDoc, logger, config }) {
	const workAliases = [
		'works-' + config.elasticsearch.aliases.stage,
		'works-' + config.elasticsearch.aliases.current
	];

	for (const index of workAliases) {
		let workDocResp;
		try {
			workDocResp = await expertModel.client.get({
				index,
				id: workId,
				_source: true
			});
		} catch (e) {
			logger.info({ workId, index, error: e.message }, 'authorship.patch work document not found');
			continue;
		}

		// update work doc relatedBy
		const workDoc = workDocResp?._source;
		if (!workDoc || !Array.isArray(workDoc['@graph'])) continue;

		const rootNode = workDoc['@graph'].find(n => n && n['@id'] === workDoc['@id']);
		if (!rootNode) continue;

		if (!Array.isArray(rootNode.relatedBy)) {
			rootNode.relatedBy = rootNode.relatedBy ? [rootNode.relatedBy] : [];
		}

		const rootRoleIndex = findRelatedByRoleIndex(rootNode.relatedBy, rid);
		if (rootRoleIndex === -1) {
			logger.info({ workId, index, rid, expertId }, 'authorship.patchWorkDocument no matching relatedBy role');
			continue;
		}

		const rootRole = rootNode.relatedBy[rootRoleIndex];

		logger.info({
			workId,
			index,
			rid,
			expertId,
			selectedRoleId: rootRole['@id'],
			selectedRoleBefore: JSON.parse(JSON.stringify(rootRole))
		}, 'authorship.patchWorkDocument selected root role');

		mutateRoleForActor(rootRole, patch, expertId);

		// Enforce one-role-per-actor by removing this actor from all non-target roles.
		rootNode.relatedBy.forEach((rel, idx) => {
			if (idx === rootRoleIndex) return;
			removeActorFromRole(rel, expertId);
		});

		logger.info({
			workId,
			index,
			rid,
			expertId,
			selectedRoleAfter: rootRole
		}, 'authorship.patchWorkDocument role after patch mutation');

		const visibleExpertIds = new Set();
		for (const rel of rootNode.relatedBy) {
			if (rel?.['is-visible'] !== true) continue;
			const relates = normalizeRelates(rel.relates);
			for (const relId of relates) {
				if (typeof relId === 'string' && relId.startsWith('expert/')) {
					visibleExpertIds.add(relId);
				}
			}
		}

		const nextGraph = [];
		const expertNodesById = new Map();

		// add/remove expert from graph based on visibility
		for (const gNode of workDoc['@graph']) {
			if (!gNode || !gNode['@id']) continue;
			if (gNode['@id'] === workDoc['@id']) {
				nextGraph.push(rootNode);
				continue;
			}

			const types = Array.isArray(gNode['@type']) ? gNode['@type'] : (gNode['@type'] ? [gNode['@type']] : []);
			const isExpertNode =
				gNode['@id'].startsWith('expert/') ||
				types.includes('Expert') ||
				types.includes('Person');

			if (!isExpertNode) {
				nextGraph.push(gNode);
				continue;
			}

			expertNodesById.set(gNode['@id'], gNode);
			if (visibleExpertIds.has(gNode['@id'])) {
				nextGraph.push(gNode); // keep visible experts
			}
			// else: drop hidden experts from graph
		}

		// Ensure every visible expert has a node (add missing)
		const expertAlias = index.includes(config.elasticsearch.aliases.stage)
			? 'experts-' + config.elasticsearch.aliases.stage
			: 'experts-' + config.elasticsearch.aliases.current;

		for (const visibleExpertId of visibleExpertIds) {
			if (expertNodesById.has(visibleExpertId)) continue;

			if (visibleExpertId === expertId && expertDoc) {
				const expertRoot = getExpectedModelNode(expertDoc);
				nextGraph.push(expertSnippet(expertRoot));
				continue;
			}

			try {
				const exResp = await expertModel.client.get({
					index: expertAlias,
					id: visibleExpertId,
					_source: true
				});
				const exRoot = getExpectedModelNode(exResp._source);
				nextGraph.push(expertSnippet(exRoot));
			} catch (e) {
				logger.info({ workId, index, visibleExpertId, error: e.message }, 'authorship.patch missing expert node source');
			}
		}

		workDoc['@graph'] = nextGraph;
		workDoc['is-visible'] = rootNode.relatedBy.some(rel => rel?.['is-visible'] === true);

		try {
			const indexResp = await expertModel.client.index({
				index,
				id: workDoc['@id'],
				document: workDoc,
				if_seq_no: workDocResp._seq_no,
				if_primary_term: workDocResp._primary_term,
				refresh: 'wait_for'
			});

			logger.info({
				workId,
				index,
				result: indexResp?.result,
				version: indexResp?._version,
				seqNo: indexResp?._seq_no,
				primaryTerm: indexResp?._primary_term,
				expectedWorkIsVisible: workDoc['is-visible'],
				expectedGraphExpertIds: workDoc['@graph']
					.filter(n => typeof n?.['@id'] === 'string' && n['@id'].startsWith('expert/'))
					.map(n => n['@id'])
			}, 'authorship.patchWorkDocument write success');

			const verifyResp = await expertModel.client.get({
				index,
				id: workDoc['@id'],
				_source: true
			});
			const verifyDoc = verifyResp?._source || {};
			const verifyGraph = Array.isArray(verifyDoc['@graph']) ? verifyDoc['@graph'] : [];

			logger.info({
				workId,
				index,
				persistedWorkIsVisible: verifyDoc['is-visible'],
				persistedGraphExpertIds: verifyGraph
					.filter(n => typeof n?.['@id'] === 'string' && n['@id'].startsWith('expert/'))
					.map(n => n['@id'])
			}, 'authorship.patchWorkDocument post-write verify');
		} catch (e) {
			logger.error({
				workId,
				index,
				error: e.message,
				meta: e.meta?.body || e.meta || null,
				expectedWorkIsVisible: workDoc['is-visible']
			}, 'authorship.patchWorkDocument write failed');
		}
	}
}

async function patchWorkEsVisibility({ expertModel, patch, expertId, logger, config }) {
	const id = patch['@id'];
	let expert;

	logger.info({ patch }, `authorship.patch ${expertId}:`);
	// This patch adds a relationship field back in, while we decide the best method
	const rid = id.replace('ark:/87287/d7mh2m/', 'ark:/87287/d7mh2m/relationship/');
	if (patch.visible == null && patch.favourite == null) {
		return 400;
	}

	let node;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
		node = getNodeByRelatedId(expert, rid);
		const nodeId = node['@id'].replace('ark:/87287/d7mh2m/publication/', '');
		if (patch.objectId == null) {
			patch.objectId = nodeId;
		}
	} catch (e) {
		console.error(e.message);
		return 404;
	}

	if (!Array.isArray(node.relatedBy)) {
		node.relatedBy = node.relatedBy ? [node.relatedBy] : [];
	}

	const roleIndex = findRelatedByRoleIndex(node.relatedBy, rid);
	if (roleIndex === -1) {
		throw {
			status: 500,
			message: `Role ${rid} not found in work relatedBy array`
		};
	}

	const selectedRoleBefore = JSON.parse(JSON.stringify(node.relatedBy[roleIndex]));
	mutateRoleForActor(node.relatedBy[roleIndex], patch, expertId);

	if (patch.visible != null) {
		node['is-visible'] = patch.visible === true;
	}

	// update both public/latest to keep them in sync
	await updateGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.stage);
	await updateGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.current);

	await patchWorkDocumentVisibility({
		expertModel,
		workId: node['@id'],
		patch,
		rid,
		expertId,
		expertDoc: expert,
		logger,
		config
	});
}

async function patchWorkCdlVisibility({ expertModel, patch, expertId, logger, config }) {
	const id = patch['@id'];
	const rid = id.replace('ark:/87287/d7mh2m/', 'ark:/87287/d7mh2m/relationship/');
	let expert;
	let node;
	let resp;

	try {
		expert = await getExpertDocument(expertModel, expertId, config);
		node = getNodeByRelatedId(expert, rid);
		if (patch.objectId == null) {
			patch.objectId = node['@id'].replace('ark:/87287/d7mh2m/publication/', '');
		}
	} catch (e) {
		console.error(e.message);
		return 404;
	}

	const cdl_user = await impersonateCdlUser(expert, config.experts.cdl.authorship);

	if (patch.visible != null) {
		logger.info('CDL propagate visibility', patch.visible);
		resp = await cdl_user.setLinkPrivacy({
			objectId: patch.objectId,
			categoryId: 1,
			privacy: patch.visible ? 'public' : 'internal'
		});
	}
	if (patch.favourite != null) {
		logger.info('CDL propagate favourite', patch.favourite);
		patch.categoryId = 1;
		resp = await cdl_user.setFavourite(patch);
	}

	logger.info({ cdl_response: resp }, `CDL work visibility update`);
}

async function patchWorkVisibility({ expertModel, patch, expertId, logger, config }) {
	await patchWorkEsVisibility({ expertModel, patch, expertId, logger, config });
	if (config.experts.cdl.authorship.propagate) {
		await patchWorkCdlVisibility({ expertModel, patch, expertId, logger, config });
	} else {
		logger.info({ cdl_response: null }, `XCDL propagate changes ${config.experts.cdl.authorship.propagate}`);
	}
}

async function deleteAuthorship({ expertModel, id, expertId, logger, config }) {
	logger.info(`Deleting ${id}`);

	let node;
	let expert;
	let objectId;
	let resp;

	const rid = id.replace('ark:/87287/d7mh2m/', 'ark:/87287/d7mh2m/relationship/');

	expert = await getExpertDocument(expertModel, expertId, config);
	node = getNodeByRelatedId(expert, rid);
	objectId = node['@id'].replace('ark:/87287/d7mh2m/publication/', '');

	// update both public/latest to keep them in sync
	await deleteGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.stage);
	await deleteGraphNode(expertModel, expertId, node, 'experts-' + config.elasticsearch.aliases.current);

	await patchWorkDocumentVisibility({
		expertModel,
		workId: node['@id'],
		patch: { visible: false },
		rid,
		expertId,
		expertDoc: expert,
		logger,
		config
	});

	if (config.experts.cdl.authorship.propagate) {
		const linkId = rid.replace('ark:/87287/d7mh2m/relationship/', '');
		const cdlUser = await impersonateCdlUser(expert, config.experts.cdl.authorship);
		logger.info({ cdl_request: { linkId: id, objectId } }, `CDL propagate changes ${config.experts.cdl.authorship.propagate}`);
		resp = await cdlUser.reject({
			linkId,
			categoryId: 1,
			objectId
		});
		logger.info({ cdl_response: resp }, `CDL propagate changes ${config.experts.cdl.authorship.propagate}`);
	} else {
		logger.info({ cdl: null }, `CDL propagate changes ${config.experts.cdl.authorship.propagate}`);
	}
}

export {
  patchExpertEsVisibility,
  patchExpertCdlVisibility,
  patchExpertVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchGrantRoleVisibility,
  patchGrantEsVisibility,
  patchGrantCdlVisibility,
  patchGrantVisibility,
  patchWorkDocumentVisibility,
  patchWorkEsVisibility,
  patchWorkCdlVisibility,
  patchWorkVisibility,
  deleteAuthorship,
};
