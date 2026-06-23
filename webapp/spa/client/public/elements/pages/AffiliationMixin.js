import { ORG_LOOKUP } from '../../lib/org-lookup.js';

/**
 * @mixin AffiliationMixin
 * @description Shared affiliation/department filter behaviour for search and browse pages.
 * Handles orgLookup initialisation and all dept filter interactions.
 */
export const AffiliationMixin = (superClass) => class extends superClass {

  constructor() {
    super();
    this.orgLookup = ORG_LOOKUP
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(cat => ({
        ...cat,
        subCategories: cat.subCategories
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label))
          .map(sub => ({
            ...sub,
            depts: sub.depts.slice().sort((a, b) => a.name.localeCompare(b.name))
          }))
      }));
  }

  /**
   * @method _onDeptChange
   * @description handles individual department checkbox change events
   * @param {Object} e change event
   */
  _onDeptChange(e) {
    const code = e.currentTarget.value;
    if( e.currentTarget.checked ) {
      if( !this.dept.includes(code) ) this.dept = [...this.dept, code];
    } else {
      this.dept = this.dept.filter(d => d !== code);
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _onSubCategoryCheck
   * @description toggles all departments under a sub-category
   * @param {Array} subDepts array of department objects in the sub-category
   */
  _onSubCategoryCheck(subDepts) {
    const codes = subDepts.map(d => d.deptCode);
    const checkedCount = codes.filter(c => this.dept.includes(c)).length;
    const allChecked = checkedCount === codes.length;
    if( !allChecked ) {
      const merged = [...this.dept];
      codes.forEach(c => { if( !merged.includes(c) ) merged.push(c); });
      this.dept = merged;
    } else {
      this.dept = this.dept.filter(d => !codes.includes(d));
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _getDept
   * @description look up a department object by dept code
   * @param {String} code dept code
   * @returns {Object|null} department object or null
   */
  _getDept(code) {
    for( const cat of (this.orgLookup || []) ) {
      for( const sub of cat.subCategories ) {
        const dept = sub.depts.find(d => d.deptCode === code);
        if( dept ) return dept;
      }
    }
    return null;
  }

  /**
   * @method _getDeptName
   * @description return display name for a dept code
   * @param {String} code dept code
   * @returns {String} department display name
   */
  _getDeptName(code) {
    return this._getDept(code)?.name || code;
  }

  /**
   * @method _deptCodesToNames
   * @description convert dept codes to official names for API filtering
   * @param {Array} codes array of dept codes
   * @returns {Array} array of official dept names
   */
  _deptCodesToNames(codes) {
    return codes.map(c => this._getDept(c)?.officialName || c);
  }

  /**
   * @method _toggleSubCategory
   * @description expand or collapse a sub-category in the affiliation picker
   * @param {String} label sub-category label
   */
  _toggleSubCategory(label) {
    if( this.expandedSubCategories.includes(label) ) {
      this.expandedSubCategories = this.expandedSubCategories.filter(l => l !== label);
    } else {
      this.expandedSubCategories = [...this.expandedSubCategories, label];
    }
  }

  /**
   * @method _getDeptPillGroups
   * @description returns one entry per sub-category that has at least one selected dept,
   * with a label suffix of "(all)" or "(#)" for display as filter pills
   * @param {Array} selectedCodes currently selected dept codes
   * @returns {Array<{label: string, codes: string[]}>} pill groups
   */
  _getDeptPillGroups(selectedCodes) {
    const groups = [];
    for( const cat of (this.orgLookup || []) ) {
      for( const sub of cat.subCategories ) {
        const allCodes = sub.depts.map(d => d.deptCode);
        const selected = allCodes.filter(c => selectedCodes.includes(c));
        if( !selected.length ) continue;
        const suffix = selected.length === allCodes.length ? '(all)' : `(${selected.length})`;
        groups.push({ label: `${sub.label} ${suffix}`, codes: selected });
      }
    }
    return groups;
  }

  /**
   * @method _onAffiliationSearch
   * @description handles affiliation search input events
   * @param {Object} e input event
   */
  _onAffiliationSearch(e) {
    this.affiliationSearch = e.target.value;
  }

};
