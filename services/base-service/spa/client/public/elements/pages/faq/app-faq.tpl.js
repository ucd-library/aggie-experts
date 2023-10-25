import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
    }

    .faq-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .faq-header .faq-label {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.5rem;
      font-style: normal;
      font-weight: 700;
      line-height: 2.5rem;
      padding-right: .7rem;
      padding-left: .7rem;
    }
    svg {
      width: 20.22471911px;
      height: 75px;
    }

    .faq .section {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    .faq .section img {
      max-width: 100%;
    }

    @media (max-width: 992px) {
      .faq .section {
        width: 90%;
      }
    }

  </style>

  <div class="faq-header">
    <div class="faq-label">Help</div>
    <div style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>
<div class="faq container top">
  <div class="section">

    <h3>About Aggie Experts</h3>
    <ucd-theme-list-accordion>
      <li>What is Aggie Experts?</li>
      <li>
        Aggie Experts is a joint pilot project between the Office of the Provost and the UC Davis Library.
        Its purpose is to create a central registry of UC Davis faculty, researchers, experts and creators and showcase the scholarship created at the university.
        Aggie Experts can be used as an expertise discovery platform for finding collaborators, mentors and expert opinions.
        If you have any recommendations, you can contact us by <a href="mailto:lib-experts@ou.ad3.ucdavis.edu">email</a> or submit a request <a href="https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose">here</a>.
      </li>
      <li>I am faculty at UC Davis. Why am I not in Aggie Experts?</li>
      <li>
        The current version of Aggie Experts includes only senate faculty. We will be expanding it in stages to other researchers. If you are senate faculty, and you don't see your profile, please, <a href="mailto:lib-experts@ou.ad3.ucdavis.edu">contact us</a>.
      </li>
      <li>How often do you update the data in Aggie Experts?</li>
      <li>
        At this stage we will update the data weekly. As the project progresses, we will implement nightly updates. Grants data are updated quarterly.
      </li>
      <li>What sources do you use for my publications?</li>
      <li>
        We are using the Publication Management System adopted by the California Digital Library in support of the UC Open Access policy. The sources used are Dimensions, Scopus, Crossref, Web of Science (Lite), Europe PubMed Central, PubMed, eScholarship, arXiv, RePEc, SSRN, DBLP, CiNii EN, CiNii JP, figshare.com (limited) and Google Books. At this time only journal articles, books and book chapters, and conference papers are included in Aggie Experts.
      </li>
      <li>What sources do you use for my grants? Why can't I edit the grant records?</li>
      <li>
        We receive the data from the university's financial warehouse. They have been reconciled with UCOP records
        of awards to UC Davis and are considered the official university record. As such they cannot be edited.
        We are considering adding fields for user-generated data in the future, to clarify items such as the
        original source of a subaward.
      </li>
    </ucd-theme-list-accordion>


    <h3>Managing Your Profile</h3>
    <ucd-theme-list-accordion>
      <li>How do I export data?</li>
      <li>
        ${this.isLoggedIn  ? html`
          <div>
            <p>
              In the Publications section of your profile, you will find a download icon.
              One of the available format options is RIS. This file can be imported into MIV.
              If you want to download individual publications, click on the edit icon.
              The new page will allow you to select individual publications, which you can then
              download by clicking the Download button. Grants can be similarly exported in a
              spreadsheet.
            </p>
            <p>
              You can also reuse grants in MIV, but you have to initiate the grant request from
              your MIV account. Aggie Experts can send that information to MIV if you initiate
              the request, but has no access to any information in your account.
            </p>
          </div>
          `: html`
            <div>
              You must be logged in to view this information.
            </div>
          `}
      </li>
      <li>How do I edit my registry entry?</li>
      <li>
        What you see as your entry is a merging of several university-vetted data sources, so data editing requires logging into the original data source systems. Check the help items for instructions for editing your <a @click="${this._jumpTo}" data-jump-to="change-bio" href="#change-bio">name/title/affiliation</a> and <a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">publication record</a> on this help page.
      </li>
      <li id="change-bio">How do I change my name/title/affiliation?</li>
      <li>
        Your name, title and affiliation appear as they are shown in the UC Davis online directory or in UC Path. To change them, update the <a href="https://org.ucdavis.edu/odr/">campus directory</a> listing, and once the changes are approved by directory administrators, they will be reflected in Aggie Experts at the next update. More information on the UC Davis Directory can be found <a href="https://org.ucdavis.edu/directory/index.html">here</a>. If you are not able to change the information already in the directory, you will need to contact HR directly.
      </li>
      <!-- <li id="edit-area">How do I edit my research areas?</li>
      <li>
        <p>You can select Fields of Research in your Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a>. Log in into the system and click on “Edit my profile” button.</p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        Scroll down to the FAST and Fields of Research (2008) headings and click on the pencil icon.
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords1.jpg" alt="Go to edit profile screenshot">
        You will see a search and select interface for the available research subjects options.
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords2.jpg" alt="Go to research field edit screenshot">

        Click the “Add” button for your selections.
        <img style="margin-left: auto; margin-right: auto; display: block;" src="${this.imgPath}ae-profile-edit-keywords3.jpg" alt="Add your written selections">

        After selecting all the research areas you would like to add to your profile, remember to click “Save changes” at the bottom of the box.
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords4.jpg" alt="Go to research field selection screenshot">
        Note that at the present time once you make your selections in the Publication Management System, your Aggie Experts research areas will
        be updated after the next data reload, which happens weekly. Also, once the research fields selections coming from the System are detected,
        they will replace the automatically-generated Aggie Experts research areas with your selections.
      </li> -->
      <li>How do I add more information to what you already have in Aggie Experts?</li>
      <li>
        <p>Most of the data we add to Aggie Experts come from authoritative sources, and changing and updating the data in them is addressed in separate questions, eg. “<a @click="${this._jumpTo}" data-jump-to="change-bio" href="#change-bio">How do I change my name/title/affiliation</a>” and “<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record</a>”. An exception is the “About” section in your profile. Currently, you can add more websites by logging into UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and clicking on the “Edit my profile” button.</p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>You will be able to edit the “About” section there, which includes websites you would like to link to from Aggie Experts. In one of the future iterations of Aggie Experts we plan to bring in research overviews, if you have provided such to the university for public view. If you choose to populate them directly in the Publication Management System, it will make the overview upload easier.</p>
      </li>
      <li>Why are there so few / no publications in my Aggie Experts profile?</li>
      <li>
        Most likely you have not claimed your publications in the Publication Management System we are using as a data source. Please, refer to “<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record?</a>” to enrich your publication list.
      </li>
      <li>Why are there incorrect publications on my profile? How do I remove them?</li>
      <li>
        The process used to enrich profiles with publications relies on publication aggregations
        associated with author ids, such as Scopus ID, Researcher ID and ORCID ID.
        Some of the publication aggregations are machine-generated and may contain mistakes.
        You can curate your publication list by clicking on the edit icon on your profile
        and then on the trash icon by the incorrect publication to reject it. If a significant
        number of publications are incorrect, please, <a href="mailto:lib-experts@ou.ad3.ucdavis.edu">contact us</a>.
      </li>

      <li id="change-pub">How do I edit my publication record?</li>
      <li>
        <p>It is very likely that you have additional publications in your Publication Management System pending queue. To review your queue, log into your UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to your profile.</p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>Click on either the “Claim now” or “View all” button.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-1.jpg" alt="Go to publications tab screenshot">
        <p>Click on “Pending”</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-2.jpg" alt="Select pending screenshot">
        <p>There are several elements in the pending queue that can improve your publication list. First, you can inspect each listed publication and claim the correct ones one by one.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-3.jpg" alt="Claim publication screenshot">
        <p>Second, you can improve <a @click="${this._jumpTo}" data-jump-to="pending-pub" href="#pending-pub">the search for your publications.</a></p>
      </li>
      <li id="pending-pub">How do I improve the search results for my publications?</li>
      <li>
        <p>To improve the search criteria for your publications, log into your UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to your profile. If you are already looking at your pending publication list, jump <a @click="${this._jumpTo}" data-jump-to="pending-pub" href="#pending-pub">here</a>. Otherwise, follow the instructions directly below.</p>
        <p>To review your queue, log into your UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to your profile.</p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>Click on either the “Claim now” or “View all” button.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-1.jpg" alt="Go to publications tab screenshot">
        <p>Click on “Pending”</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-2.jpg" alt="Select pending screenshot">
        <p>The quickest way to refine your search criteria is to inspect proposed external id's such as Scopus, Researcher ID from Web of Science, Dimensions, ORCID id and others. If you claim your id's, you can set the system to automatically claim publications associated with those id's.</p><br/>
        <p>Please, note that your registry entry will reflect changes to your publication list only after the next update.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-identifiers.jpg" alt="Find Identifiers screenshot">
        <p>You can also contact us for assistance with further refining the search parameters for your publications if you are missing a significant number or if you have a lot of publications that are not yours in your pending queue.</p>
      </li>
      <li id="visible-publication">How do I change the visibility of a publication or a grant?</li>
      <li>
        Click on the edit icon above the list of your works. Once the "Manage My Works" page opens,
        click on the eye icon by the publication or grant that you don't want to be displayed on
        your profile.
      </li>
      <li>How do I delete my profile?</li>
      <li>
        Log into the UC Publication Management System account and go to "Edit My Profile".
        Under "Profile privacy", switch the settings from "Public" to "Internal". After the data are
        refreshed, Aggie Experts will not display any information about you, including your name.
      </li>
    </ucd-theme-list-accordion>
  </div>
</div>

`;}
