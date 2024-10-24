import {PayloadUtils} from '@ucd-lib/cork-app-utils'

const ID_ORDER = ['lastInitial', 'page', 'size', 'browseExperts', 'browseGrants', 'expertId', 'subpage', 'search', 'grantId', 'browseType'];

let inst = new PayloadUtils({
  idParts: ID_ORDER,
  customKeyFormat : {
    org : val => val || '_',
  }
});
export default inst;
