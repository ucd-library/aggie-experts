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
- [ ] Download a single grant
- [ ] Change visibility of a grant and confirm change in Elements
- [ ] Reverse visibility through AE UI
- [ ] Search for avian flu. Confirm that searches have "search matches: # grants.
- [ ] Test download on:
      - [ ] All Results
      - [ ] Experts
      - [ ] Grants
      - [ ] Works (Currently N/A)
- [ ] Under Experts check and uncheck Availability labels. Note that the number of experts changes appropriately.
- [ ] Test download
- [ ] Click on the # grant for one of the experts. A filter with the name should appear, and only those grants should be listed
- [ ] Check download


### More extensive testing
- [ ] As an admin search for 0130. There should be only one hit
- [ ] Edit user and hide that grant
- [ ] Repeat search: confirm no results are returned
- [ ] Review grants CSV download, particularly coPI list
- [ ] Ask for a broken links review

### Before a live demo
- [ ] Download a RIS file of publications and test import into MIV
- [ ] Test pulling grants into MIV

### After a particularly major update
- [ ] Go to Browse-->M. Check that pagination works right
- [ ] Go to faculty with hundreds of publications: Check pagination again
- [ ] Edit user: check that Add work redirects to Elements
- [ ] Edit userL Check that bio fields redirect to Elements
