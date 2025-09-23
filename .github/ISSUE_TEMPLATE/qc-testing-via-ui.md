---
name: QC testing via UI
about: Checklist for testing a new version of the deployed code.
title: 'Testing '
labels: ''
assignees: ''

---

### Test date

### Reason for testing:
- [ ] New feature
- [ ] New data

### Tasks
- [ ] Impersonate a user using keycloak
- [ ] Confirm works can be downloaded from the profile
- [ ] Confirm grants can be downloaded from the profile
- [ ] Navigate to their Edit Works; review citations
- [ ] Download a single work
- [ ] Change visibility of a work and confirm change in Elements
- [ ] Reverse visibility through AE UI
- [ ] Navigate to their Edit grants; review citations
- [ ] Download a single grant. Inspect PI/coPI column
- [ ] Change visibility of a grant and confirm change in Elements
- [ ] Reverse visibility through AE UI
- [ ] Search for avian influenza. Confirm that searches have "search matches: # grants, # works.
- [ ] Click on the # grant for one of the experts. A filter with the name should appear, and only those grants should be listed
- [ ] Test download on:
      - [ ] All Results
      - [ ] Experts
      - [ ] Grants
      - [ ] Works
- [ ] Under Experts check and uncheck Availability labels. Note that the number of experts changes appropriately.
- [ ] Test download

### Notes on data counts

###
- [ ] Check (compare to standard) data output for the SiteFarm API
- [ ] Check (compare to standard) data output for MIV API

### More extensive testing
- [ ] Search for an invisible work: confirm no results are returned
- [ ] Search for an invisible grant: confirm no results are returned
- [ ] Revert any changes made to visibility


### Before a live demo
- [ ] From production, download a RIS file of publications and test import into MIV
- [ ] Test pulling grants into MIV

### After a particularly major update
- [ ] Go to Browse-->M. Check that pagination works right
- [ ] Go to faculty with hundreds of publications: Check pagination again
- [ ] Edit user: check that Add work redirects to Elements
- [ ] Edit user: Check that bio fields redirect to Elements
- [ ] Ask for a broken links review
- [ ] Do a complex search. E.g. (cardiac | heart) + (injury | trauma)
