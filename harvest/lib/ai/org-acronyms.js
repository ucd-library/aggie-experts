/**
 * @module org-acronyms
 * @description Expansion map and lookup for UC Davis department/school acronyms
 * as they appear in vCard Organization titles sourced from PPS and ODR systems.
 */

/**
 * Map of uppercase acronym → full UC Davis organizational name.
 * Covers schools, colleges, and common department-level abbreviations.
 * Entries are sorted longest-first so the generated regex prefers longer matches.
 */
const ACRONYM_MAP = new Map([
  // Schools and colleges
  ['CAES',  'College of Agricultural and Environmental Sciences'],
  ['CBS',   'College of Biological Sciences'],
  ['ENG',   'College of Engineering'],
  ['GSM',   'Graduate School of Management'],
  ['SPH',   'School of Public Health'],
  ['SOM',   'School of Medicine'],
  ['SOE',   'School of Education'],
  ['SOL',   'School of Law'],
  ['SON',   'School of Nursing'],
  ['SVM',   'School of Veterinary Medicine'],
  ['VM',    'School of Veterinary Medicine'],
  ['MD',    'School of Medicine'],

  // Engineering departments
  ['ECE',   'Electrical and Computer Engineering'],
  ['MAE',   'Mechanical and Aerospace Engineering'],
  ['CEE',   'Civil and Environmental Engineering'],
  ['BME',   'Biomedical Engineering'],
  ['MSE',   'Materials Science and Engineering'],
  ['CHE',   'Chemical Engineering'],
  ['CS',    'Computer Science'],

  // Agricultural and Environmental Sciences departments
  ['ARE',   'Agricultural and Resource Economics'],
  ['ANS',   'Animal Science'],
  ['PLS',   'Plant Sciences'],
  ['FST',   'Food Science and Technology'],
  ['NUT',   'Nutrition'],
  ['ENT',   'Entomology'],
  ['ESM',   'Environmental Science and Management'],
  ['LDA',   'Landscape Architecture'],

  // Biological Sciences departments
  ['MCB',   'Molecular and Cellular Biology'],
  ['EVE',   'Evolution and Ecology'],
  ['NPB',   'Neurobiology, Physiology, and Behavior'],
  ['MIC',   'Microbiology and Molecular Genetics'],
  ['PBI',   'Plant Biology'],

  // Letters and Science departments
  ['ECN',   'Economics'],
  ['SOC',   'Sociology'],
  ['POL',   'Political Science'],
  ['PSY',   'Psychology'],
  ['COM',   'Communication'],
  ['HIS',   'History'],
  ['PHI',   'Philosophy'],
  ['LIN',   'Linguistics'],
  ['ANT',   'Anthropology'],
  ['MAT',   'Mathematics'],
  ['STA',   'Statistics'],
  ['PHY',   'Physics'],
  ['CHM',   'Chemistry'],
  ['GEL',   'Geology'],
  ['ART',   'Art and Art History'],
  ['MUS',   'Music'],
  ['THE',   'Theatre and Dance'],

  // School of Medicine departments
  ['ANE',   'Anesthesiology and Pain Medicine'],
  ['DRM',   'Dermatology'],
  ['EMD',   'Emergency Medicine'],
  ['NEU',   'Neurology'],
  ['OBG',   'Obstetrics and Gynecology'],
  ['OPH',   'Ophthalmology and Vision Science'],
  ['OTO',   'Otolaryngology'],
  ['ORT',   'Orthopedic Surgery'],
  ['PED',   'Pediatrics'],
  ['PMR',   'Physical Medicine and Rehabilitation'],
  ['PSC',   'Psychiatry and Behavioral Sciences'],
  ['RAD',   'Radiology'],
  ['SUR',   'Surgery'],
  ['URO',   'Urology'],
  ['FAM',   'Family and Community Medicine'],
  ['GEN',   'Genetics'],
  ['HEM',   'Hematology and Oncology'],
  ['INF',   'Infectious Diseases'],
  ['PAT',   'Pathology and Laboratory Medicine'],
  ['PUL',   'Pulmonary, Critical Care, and Sleep Medicine'],
  ['RHE',   'Rheumatology, Allergy, and Clinical Immunology'],

  // Veterinary Medicine departments
  ['ANP',   'Anatomy, Physiology, and Cell Biology'],
  ['PMI',   'Pathology, Microbiology, and Immunology'],
  ['POP',   'Population Health and Reproduction'],

  // Administration and research units
  ['HR',    'Human Resources'],
  ['IT',    'Information Technology'],
  ['OIT',   'Office of Information Technology'],
  ['DSS',   'Decision and Policy Sciences'],
  ['ITS',   'Information and Technology Services'],
]);

// Build a regex that matches any acronym as a whole word, longest first to
// avoid shorter alternatives shadowing longer ones (e.g. VM before V).
const _keys = Array.from(ACRONYM_MAP.keys()).sort((a, b) => b.length - a.length);
const _pattern = new RegExp(`\\b(${_keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');

/**
 * @function expandOrgAcronyms
 * @description Replace UC Davis organizational acronyms in a string with their
 * full names. Only whole-word, case-sensitive matches are replaced so that
 * common substrings (e.g. "IT" inside "AUDIT") are not affected.
 * @param {String} title - organization title that may contain acronyms
 * @returns {String} title with known acronyms expanded
 */
function expandOrgAcronyms(title) {
  if (!title) return title;
  return title.replace(_pattern, match => ACRONYM_MAP.get(match) ?? match);
}

export { ACRONYM_MAP, expandOrgAcronyms };
