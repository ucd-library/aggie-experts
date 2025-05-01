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
        <p>
          Aggie Experts is a platform for finding researchers and experts at UC Davis. A pilot project led jointly 
          by the Office of the Provost and the UC Davis Library, it is designed to facilitate interdisciplinary 
          collaboration, showcase the research being done at the university, and reduce administrative workload for 
          faculty. Aggie Experts can be used to find collaborators, mentors and expert opinions.          
        </p>
      </li>
      <li>I am faculty at UC Davis. Why am I not in Aggie Experts?</li>
      <li>
        <p>
          Aggie Experts includes Academic Senate and Federation faculty and researchers. 
          If you are a current member of the Academic Senate or Federation and you don't 
          see your profile, please <a href="mailto:experts@ucdavis.edu">contact us</a>.
        </p>
      </li>
      <li>How often do you update the data in Aggie Experts?</li>
      <li>
        <p>
          We currently update the scholarly publications data weekly. Grants data are updated quarterly.
        </p>
      </li>
      <li>What sources do you use for my publications?</li>
      <li>
        <p>
          We are using the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a> as the primary source of publications. 
          It aggregates records of UC Davis authors from Dimensions, Scopus, Crossref, Web of Science (Lite), 
          Europe PubMed Central, PubMed, eScholarship, arXiv, RePEc, SSRN, DBLP, CiNii EN, CiNii JP, 
          figshare.com (limited) and Google Books. At this time only journal articles, books, book chapters, 
          and conference papers are included in Aggie Experts. Visit our <a href="https://guides.library.ucdavis.edu/open-access-publishing/ucpms">library guide</a> for tips on how to login 
          and manage your publications in the UC Publication Management System.
        </p>
      </li>
      <li>What sources do you use for my grants? Why can't I edit the grant records?</li>
      <li>
        <p>
          We receive grant data from the university's financial warehouse. They have been reconciled with UCOP records 
          of awards to UC Davis and are considered the official university record. As such, they cannot be 
          edited directly. If information is displaying improperly in Aggie Experts (for example, a 
          grant title getting cut off that is longer than the default character count), please <a href="mailto:experts@ucdavis.edu">contact us</a> for assistance. 
          For changes to other information about a grant, please contact your unit's finance office.
        </p>
      </li>
    </ucd-theme-list-accordion>


    <h3>Managing Your Profile</h3>
    <ucd-theme-list-accordion>
      <li>How do I export data?</li>
      <li>
        ${this.isLoggedIn  ? html`
        <p>
          In the Publications section of your profile, you will find a Download icon to export publications as an RIS file. 
          This file can be used in citation management systems, such as Zotero.
        </p>
        <p>
          If you want to download individual publications, click the Edit icon. The new page will allow you to select 
          individual publications, which you can then download by clicking the Download button. Grants can be similarly 
          exported in a spreadsheet.
        </p>
        `: html`<p>You must be logged in to view this information.</p>`}
      </li>
      <li>How do I edit my Aggie Experts profile?</li>
      <li>
        <p>
          What you see as your entry is a merging of several university-vetted data sources, so data editing 
          requires logging into the original data source systems. Check the instructions below for editing your  
          <a @click="${this._jumpTo}" data-jump-to="change-bio" href="#change-bio">name/title/affiliation</a> 
          and <a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">publication record</a> on this help page.
        </p>
      </li>
      <li id="change-bio">How do I change my name/title/affiliation?</li>
      <li>
        <p>
          Your name, title and affiliation appear as they are shown in the UC Davis online directory or in UCPath. 
          To change them, update the <a href="https://org.ucdavis.edu/odr/">campus directory</a> listing, and once the changes are approved by directory administrators, 
          they will be reflected in Aggie Experts at the next update. More information on the UC Davis Directory can be 
          found <a href="https://org.ucdavis.edu/directory/index.html">here</a>. If you are not able to change the information already in the directory, you will need to contact HR.          
         </p>
      </li>
      <li>How do I add more information to what you already have in Aggie Experts?</li>
      <li>
        <p>
          Most data in Aggie Experts is imported from other university sources. Changing and updating the data in 
          them is addressed in separate questions, e.g., "<a @click="${this._jumpTo}" data-jump-to="change-bio" href="#change-bio">How do I change my name/title/affiliation</a>" 
          and "<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record</a>."
        </p>
        <p>
          To add an introduction and more websites to the "About Me" section of your profile, click on the Edit icons. 
          You will be redirected to log into your UC Publication Management System <a href="https://oapolicy.universityofcalifornia.edu/">account</a>, where you can edit 
          the "About" section, including your research overview and any websites you would like to link to from Aggie Experts.
        </p>
      </li>
      <li>Why are there so few / no publications in my Aggie Experts profile?</li>
      <li>
        <p>
          Most likely you have not claimed your publications in the UC Publication Management System, which we use as a data 
          source. Refer to "<a @click="${this._jumpTo}" data-jump-to="change-pub" href="#change-pub">How do I edit my publication record?</a>"
          to enrich your publication list.
        </p>
      </li>
      <li>Why are there incorrect publications on my profile? How do I remove them?</li>
      <li>
        <p>
          The process used to enrich profiles with publications relies on publication aggregations linked to author IDs, s
          uch as Scopus ID, Researcher ID and ORCID ID. Some of the publication aggregations are machine-generated 
          and may contain errors. You can curate your publication list by clicking the Edit icon on your Aggie Experts 
          profile and then on the Trash icon by the incorrect publication to reject it. If a significant number of 
          publications are incorrect, please <a href="mailto:experts@ucdavis.edu">contact us</a>.
        </p>
      </li>

      <li id="change-pub">How do I edit my publication record?</li>
      <li>
        <p>
          If publications are missing from your Aggie Experts profile, it is likely that you have additional 
          publications in your "Pending" queue in the UC Publication Management System. 
        </p>
        <p>
          To review your queue, in your Aggie Experts profile go to Edit Works. 
          Under your name find the "+ Add New Work" button. It will take you to your pending queue.
          <br>
          Alternatively, you can login to your UC Publication Management System 
          <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go directly to your profile.
        </p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>Click on either the "Claim now" or "View all" button.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-1.jpg" alt="Go to publications tab screenshot">
        <p>Click on "Pending"</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-2.jpg" alt="Select pending screenshot">
        <p>
          There are several elements in the pending queue that can improve your publication list. 
          First, you can inspect each listed publication and claim the correct ones one by one.
        </p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-3.jpg" alt="Claim publication screenshot">
        <p>
          Second, you can improve <a @click="${this._jumpTo}" data-jump-to="pending-pub" href="#pending-pub">the search criteria for your publications.</a>
        </p>
      </li>
      <li id="pending-pub">How do I improve the search results for my publications?</li>
      <li>
        <p>
          To improve the search criteria for your publications, log into your UC Publication Management System 
          <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to your profile. 
          If you are already looking at your pending publication list, jump <a @click="${this._jumpTo}" data-jump-to="pending-pub" href="#pending-pub">here</a>. 
          Otherwise, follow the instructions directly below.
        </p>
        <p>
          To review your queue, log into your UC Publication Management System 
          <a href="https://oapolicy.universityofcalifornia.edu/">account</a> and go to your profile.
        </p>
        <img class="fw" src="${this.imgPath}ae-profile-edit-keywords-and-privacy.jpg" alt="Go to profile screenshot">
        <p>Click on either the "Claim now" or "View all" button.</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-1.jpg" alt="Go to publications tab screenshot">
        <p>Click on "Pending"</p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-2.jpg" alt="Select pending screenshot">
        <p>
          The quickest way to refine your search criteria is to inspect proposed external IDs such as Scopus, 
          Researcher ID from Web of Science, Dimensions, ORCID and others. If you claim your IDs,
          you can set the system to automatically claim publications associated with those IDs.
        </p><br/>
        <p>
          Please note: Your Aggie Experts profile will reflect changes to your publication list only after the next update.
        </p>
        <img class="fw" src="${this.imgPath}ae-publications-claim-identifiers.jpg" alt="Find Identifiers screenshot">
        <p>
          You can also contact us for assistance with further refining the search parameters for your publications 
          if you are missing a significant number or if you have a lot of publications that are not yours in your pending queue.
        </p>
      </li>
      <li id="visible-publication">How do I change the visibility of a publication or a grant?</li>
      <li>
        <p>
          Click on the Edit icon above the list of your works. Once the "Manage My Works" page opens, 
          click on the eye icon by the publication or grant that you do not want to be displayed on your profile.
        </p>

        <h6 style="margin-bottom: .5rem; margin-top: 1.5rem;">Troubleshooting</h6>
        <p>
          Aggie Experts uses the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a> as its official record of an expert's citations. 
          When an expert makes an editorial change, such as changing the visibility of a citation, this action is first 
          performed on the data you see in Aggie Experts, and then propagated to the UC Publication Management System. 
          If that system is not available, the process might fail, and you will see an error message. In this case, 
          the expert's selection may be reverted when the next sync with this system takes place. You can make the 
          desired changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management Syste</a>, and these changes will be reflected on 
          the next synchronization.
        </p>
      </li>

      <li id="reject-publication">How do I reject a publication?</li>
      <li>
        <p
          Click on the Edit icon above the list of your works. Once the "Manage My Works" page opens, click on the Trash can 
          icon by the publication that you want to disclaim.
        </p>

        <h6 style="margin-bottom: .5rem; margin-top: 1.5rem;">Troubleshooting</h6>
        <p>
          Aggie Experts uses the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a> as its official record of an expert's citation. 
          When an expert makes an editorial change, such as rejecting a citation, this action is first performed on the 
          data you see in Aggie Experts, and then propagated to the UC Publication Management System. If that system is 
          not available, the process might fail, and you will see an error message. In this case, the expert's selection 
          may be reverted when the next sync with this system takes place. You can make the desired changes directly 
          in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a>, and these changes will be reflected on the next synchronization.
        </p>
      </li>

      <li>How do I delete my profile?</li>
      <li>
        <p>
          Once you login to your profile, you will see a Trash icon above your name. Clicking it will remove your 
          profile from Aggie Experts.<br>
          <strong>Note:</strong> if some of your works have been co-authored with other experts who remain in the system, 
          these works will remain in the database.  
        </p>

        <h6 style="margin-bottom: .5rem; margin-top: 1.5rem;">Troubleshooting</h6>
        <p>
          Aggie Experts uses the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a> as its official record of an expert's visibility. 
          When an expert chooses to delete their profile in Aggie Experts, this action is first performed on the 
          data in Aggie Experts, and then propagated to the UC Publication Management System. If that system is not 
          available, the process might fail, and you will see an error message. The Aggie Experts profile will be 
          removed in all cases, but it may be reinstated when the next sync with this system takes place. 
        </p>
        <p>
          If you receive an error message, you can prevent your profile from being reinstated by logging in directly to 
          the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System</a> and going to "Edit My Profile." Under "Profile Privacy", switch 
          the settings from "Public" to "Internal." After the data are refreshed, Aggie Experts will not display 
          any information about you, including your name.
        </p>
      </li>
    </ucd-theme-list-accordion>

    <h3 style="margin-bottom: 1rem;">Data reuse for administrative purposes</h3>
    <p style="margin-top: 0; padding-top: 0;">
      Aggie Experts streamlines administrative processes requiring data entry about faculty scholarship. 
      The reduction of administrative burden on faculty and their support staff was one of the key goals driving 
      the design of the platform. Aggie Experts currently enables data reuse for MIV, other UC Davis websites in SiteFarm, 
      and citation managers, such as Zotero.
    </p>
    <ucd-theme-list-accordion>
      <li>How can I import my publications into MIV so that I only need to enter my information once?</li>
      <li>
        <p>
          The RIS file with publications from your profile can be imported into MIV. You can also import grant information 
          directly into MIV, but you must initiate the grant request from your MIV account.
        </p>
      </li>
      <li>I manage SiteFarm content for my department, college or school. How can we integrate information from Aggie Experts into our website?</li>
      <li>
        <p>
          In your admin interface, go to "Add content", and then select Person. In the right-hand side panel for 
          "Additional Options," scroll down until you see "Aggie Experts." Add the UC Davis email of the person whose 
          page you are editing and press the "Load Expert data" button underneath. The Person template will be populated 
          with Name, Pronouns, Email, and if available, Website URL, Bio, five most recent publications and ORCID ID. 
        </p>
        <p>
          At this time the content is editable. If you choose "Use automatic periodical sync" in the Aggie Experts section, 
          the data on the page will be refreshed automatically as data in Aggie Experts gets updated. However, 
          that would overwrite any edits you make within your site. We highly recommend that any edits to the content 
          are done centrally in Aggie Experts to ensure the system of record is up to date and consistent across platforms.
        </p>
      </li>
    </ucd-theme-list-accordion>

  </div>
</div>

`;}
