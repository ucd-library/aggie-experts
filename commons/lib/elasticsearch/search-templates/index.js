import completeSearchTemplate from './complete.js';
import completeImperativeTemplate from './complete-imperative.js';

const searchTemplates = {
  [completeSearchTemplate.id]: completeSearchTemplate,
  [completeImperativeTemplate.id]: completeImperativeTemplate
};

export default searchTemplates;