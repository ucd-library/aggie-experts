import { html } from 'lit';
import { ORG_LOOKUP } from '@ucd-lib/experts-commons/lib/org-lookup.js';
import { serializeDeptParam, deserializeDeptParam } from '@ucd-lib/experts-commons/lib/dept-utils.js';

// caret icons for expandable sub-categories in the affiliation picker
const AFFILIATION_CARET_EXPANDED = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="6" height="6"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`;
const AFFILIATION_CARET_COLLAPSED = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="4" height="6"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`;

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
   * @method _serializeDept
   * @description serialize selected dept codes to compact URL param parts
   * @param {string[]} codes selected dept codes
   * @returns {{ dept: string, deptCodesIncluded: string, deptCodesExcluded: string }}
   */
  _serializeDept(codes) {
    return serializeDeptParam(codes);
  }

  /**
   * @method _deserializeDept
   * @description deserialize dept URL params back to a flat array of dept codes
   * @param {string} dept sub-category keys param value
   * @param {string} [deptCodesIncluded] codes to include directly
   * @param {string} [deptCodesExcluded] codes to exclude from expanded keys
   * @returns {string[]} flat array of dept codes
   */
  _deserializeDept(dept, deptCodesIncluded='', deptCodesExcluded='') {
    return deserializeDeptParam(dept, deptCodesIncluded, deptCodesExcluded);
  }

  /**
   * @method _deptCodesToNames
   * @description convert dept codes to official names (kept for any display use)
   * @param {string[]} codes array of dept codes
   * @returns {string[]} array of official dept names
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
   * with a label suffix of "(all)" or "(#)" for display as filter pills. Sub-categories
   * that contain only a single department are shown with no suffix (there is nothing to
   * count or qualify with "all").
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
        let suffix = '';
        if( allCodes.length > 1 ) {
          suffix = selected.length === allCodes.length ? ' (all)' : ` (${selected.length})`;
        }
        groups.push({ label: `${sub.label}${suffix}`, codes: selected });
      }
    }
    return groups;
  }

  /**
   * @method _renderAffiliationCheckboxes
   * @description shared renderer for the affiliation department checkbox tree used by both
   * the browse and search sidebars (desktop and mobile). Sub-categories with a single
   * department are rendered as a flat selectable row rather than an accordion.
   * @param {Set<string>|null} [deptFilterSet=null] when provided, only departments whose
   *   dept code is in the set are shown (used by search to hide units with no keyword matches)
   * @returns {TemplateResult}
   */
  _renderAffiliationCheckboxes(deptFilterSet=null) {
    const search = (this.affiliationSearch || '').toLowerCase();
    return html`
      ${(this.orgLookup || []).map(cat => {
        const matchingSubs = cat.subCategories.map(sub => ({
          ...sub,
          depts: sub.depts.filter(d =>
            (!search ||
              d.name.toLowerCase().includes(search) ||
              sub.label.toLowerCase().includes(search)) &&
            (!deptFilterSet || deptFilterSet.has(d.deptCode))
          )
        })).filter(sub => sub.depts.length);
        if( !matchingSubs.length ) return '';
        return html`
          <div class="affiliation-group-label">${cat.label}</div>
          ${matchingSubs.map(sub => this._renderAffiliationSubRow(sub))}
        `;
      })}
    `;
  }

  /**
   * @method _renderAffiliationSubRow
   * @description render a single sub-category row for the affiliation picker
   * @param {Object} sub sub-category (already filtered to matching depts)
   * @returns {TemplateResult}
   */
  _renderAffiliationSubRow(sub) {
    // single-department sub-categories are a plain selectable option (no accordion)
    if( sub.depts.length === 1 ) {
      const dept = sub.depts[0];
      return html`
        <label class="affiliation-sub-row affiliation-sub-row--single">
          <input type="checkbox"
            class="affiliation-sub-checkbox"
            .value="${dept.deptCode}"
            .checked="${this.dept.includes(dept.deptCode)}"
            @change="${this._onDeptChange}">
          <span class="affiliation-sub-label">${sub.label}</span>
        </label>
      `;
    }

    const subCodes = sub.depts.map(d => d.deptCode);
    const checkedCount = subCodes.filter(c => this.dept.includes(c)).length;
    const allChecked = checkedCount === subCodes.length;
    const someChecked = checkedCount > 0 && !allChecked;
    const expanded = this.expandedSubCategories.includes(sub.label);
    return html`
      <div class="affiliation-sub-row">
        <input type="checkbox"
          class="affiliation-sub-checkbox"
          .indeterminate="${someChecked}"
          .checked="${allChecked}"
          @change="${() => this._onSubCategoryCheck(sub.depts)}">
        <span class="affiliation-toggle" @click="${() => this._toggleSubCategory(sub.label)}">
          <span class="affiliation-sub-label">${sub.label}</span>
          <span class="affiliation-sub-caret">
            ${expanded ? AFFILIATION_CARET_EXPANDED : AFFILIATION_CARET_COLLAPSED}
          </span>
        </span>
      </div>
      ${expanded ? html`
        <div class="affiliation-dept-list">
          ${sub.depts.map(d => html`
            <label class="affiliation-dept-row">
              <input type="checkbox"
                .value="${d.deptCode}"
                .checked="${this.dept.includes(d.deptCode)}"
                @change="${this._onDeptChange}">
              ${d.name}
            </label>
          `)}
        </div>
      ` : ''}
    `;
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
