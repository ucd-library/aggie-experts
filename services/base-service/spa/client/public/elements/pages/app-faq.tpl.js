import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
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
<div class="faq container top">
  <div class="section">
    <h1>FAQ</h1>

    <ucd-theme-list-accordion>
      <li>What is Aggie Experts?</li>
      <li>
        Aggie Experts is a joint pilot project between the Office of the Provost and the UC Davis Library.
        Its purpose is to create a central registry of UC Davis faculty, researchers, experts and creators and showcase the scholarship created at the university.
        Aggie Experts can be used as an expertise discovery platform for finding collaborators, mentors and expert opinions.
        In the course of two years we will be expanding the registry by adding faculty from the College of Engineering and adjusting its functionality based on user feedback.
        If you have any recommendations, you can contact us by <a href="mailto:lib-experts@ou.ad3.ucdavis.edu">email</a> or submit a request <a href="https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose">here</a>.
      </li>
      <li>I am faculty at UC Davis. Why am I not in the registry?</li>
      <li>
        The project is currently in its pilot phase. We are doing incremental addition of departments from the College of Engineering. Aggie Experts profiles, data and functionality will be changing rapidly in 2020-21.
      </li>
      <li>Why are there so few profiles in the registry?</li>
      <li>
        We are currently piloting Aggie Experts, and incrementally adding departments from the College of Engineering. After each deployment we solicit feedback, conduct a review and improve the system.
      </li>
      <li>How often do you update the data in the registry?</li>
      <li>
        At this stage we will update the data in the registry weekly. As the project progresses, we will implement nightly updates. Grants data are updated quarterly.
      </li>
      <li>How do I export data?</li>
      <li>
        ${this.isLoggedIn  ? html`
          <div>
            Currently only publications can be exported for MyInfoVault, but we are planning to expand the
            options to include other data, such as grants. You must be logged into your profile to access
            the download functionality. In the Publications section of your profile, you will find a
            download button located to the left of your publication count in the upper right-hand corner.
            One of the available format options is RIS. This file can be imported into MIV.
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
      <li id="edit-area">How do I edit my research areas?</li>
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
      </li>
      <li>How do I add more information to what you already have in the registry?</li>
      <li>
        <p>Most of the data we add to Aggie Experts come from authoritative sources, and changing and updating the data in them is addressed in separate questions, eg. “<a @click="${this._jumpTo}" data-jump-to="change-bio" href="#change-bio">How do I change my name/title/affiliation</a>” and “<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record</a>”. An exception is the “About” section in your profile. Currently, you can add more websites by logging into UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and clicking on the “Edit my profile” button.</p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>You will be able to edit the “About” section there, which includes websites you would like to link to from Aggie Experts. In one of the future iterations of Aggie Experts we plan to bring in research overviews, if you have provided such to the university for public view. If you choose to populate them directly in the Publication Management System, it will make the overview upload easier.</p>
      </li>
      <li>What sources do you use for my publications?</li>
      <li>
        We are using the Publication Management System adopted by the California Digital Library in support of the UC Open Access policy. The sources used are Dimensions, Scopus, Crossref, Web of Science (Lite), Europe PubMed Central, PubMed, eScholarship, arXiv, RePEc, SSRN, DBLP, CiNii EN, CiNii JP, figshare.com (limited) and Google Books.
      </li>
      <li>Why are there so few / no publications in my registry entry?</li>
      <li>
        Most likely you have not claimed your publications in the Publication Management System we are using as a data source. Please, refer to “<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record?</a>” to enrich your publication list.
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

      <li>What sources do you use for my grants? Why can't I edit the grant records?</li>
      <li>
        We receive the data from the university's financial warehouse. They have been reconciled with UCOP records
        of awards to UC Davis and are considered the official university record. As such they cannot be edited.
        We are considering adding fields for user-generated data in the future, to clarify items such as the
        original source of a subaward.
      </li>

      <li>How do I change the visibility of the fields in my profile?</li>
      <li>
        <p>You have granular control over the visibility of the fields in your profile.
          To do so, log into the UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a>
          and go to your account (for step-by-step instructions, see <a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">here</a>).
          Next to every information segment that you have filled out, you will see an icon with an option to make a public segment internal.
        </p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-privacy.jpg" alt="Go to edit mode screenshot">
        <p>
          You can also control the visibility of each publication displayed in Aggie Experts, as explained <a @click="${this._jumpTo}" data-jump-to="visible-publication" href="#visible-publication">here</a>.<br /><br />
          If you change the visibility of the entire profile, Aggie Experts not display any information about you, including your name.
        </p>
      </li>

      <li id="visible-publication">How do I change the visibility of a publication?</li>
      <li>
        <p>Log into your UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to “Edit my profile” </p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>Click on the View all” button.</p>
        <img class="fw" src="${this.imgPath}ae-publications-privacy-1.jpg" alt="Go to publications tab screenshot">
        <p>Click on the Globe icon.</p>
        <img class="fw" src="${this.imgPath}ae-publications-privacy-2.jpg" alt="Hide publication screenshot">
        <p>Click on the “Private” icon.</p>
        <img class="fw" src="${this.imgPath}ae-publications-privacy-3.jpg" alt="Private publication screenshot">
      </li>
    </ucd-theme-list-accordion>
  </div>
</div>

`;}
