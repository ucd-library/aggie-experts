import {PayloadUtils} from '@ucd-lib/cork-app-utils'

const ID_ORDER = ['lastInitial', 'page', 'size', 'browseExperts', 'expertId', 'subpage', 'search'];

let inst = new PayloadUtils({
  idParts: ID_ORDER,
  customKeyFormat : {
    org : val => val || '_',
  }
});
export default inst;
