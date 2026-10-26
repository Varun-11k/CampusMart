import { Link } from 'react-router-dom'

const documents = {
  privacy: {
    eyebrow: 'Your information',
    title: 'Privacy notice',
    intro: 'A clear overview of the information CampusMart handles to provide its campus marketplace and community features.',
    sections: [
      {
        heading: 'Information you choose to share',
        paragraphs: [
          'CampusMart handles details you submit for an account or profile, product listings and photos, messages, lost-and-found reports, campus voice posts, and other feature interactions.',
          'Please avoid including passwords, payment credentials, or sensitive personal details in listings, messages, reports, or public posts.',
        ],
      },
      {
        heading: 'How information is used',
        paragraphs: [
          'Information is used to operate accounts, show listings and community posts, support search and messaging, personalize available recommendations, and help keep the service reliable and safe.',
        ],
      },
      {
        heading: 'What other students can see',
        paragraphs: [
          'Listings and lost-and-found reports are shared with other CampusMart users so they can discover items and respond. Messages are shown to the people in that conversation.',
          'Campus Voices posts are presented publicly as anonymous in the app. The service still associates posts with an account for features such as managing your posts and moderating the community.',
        ],
      },
      {
        heading: 'Your device and account',
        paragraphs: [
          'While you are signed in, CampusMart keeps your session token and cached profile in your browser storage so you can continue using your account. Logging out removes those locally stored session details.',
          'You can manage content through the controls available for each feature. On a shared device, log out when you have finished.',
        ],
      },
      {
        heading: 'Questions',
        paragraphs: [
          'For questions about using CampusMart, visit the Campus AI page or contact the CampusMart team through the support channel provided by your campus.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'Community standards',
    title: 'Terms of use',
    intro: 'These guidelines help students use CampusMart thoughtfully. By using the service, you agree to follow them and any applicable campus rules.',
    sections: [
      {
        heading: 'Use the marketplace honestly',
        paragraphs: [
          'Only post items you are allowed to offer. Keep descriptions, condition, price, and photos accurate, and update or remove a listing when it is no longer available.',
          'CampusMart helps students discover listings and contact one another; students are responsible for deciding whether to proceed with a transaction.',
        ],
      },
      {
        heading: 'Meet and exchange safely',
        paragraphs: [
          'Use care when arranging a handoff, choose a suitable public place, and do not share passwords or payment credentials in public content or messages.',
          'CampusMart does not take custody of items or arrange payment or delivery. Confirm details directly with the other student before meeting.',
        ],
      },
      {
        heading: 'Respect the community',
        paragraphs: [
          'Do not use CampusMart to harass, threaten, impersonate, defraud, or publish someone else’s private information. Keep reports and campus posts relevant and respectful.',
          'Campus Voices are displayed anonymously, but anonymity is not a reason to post identifying or harmful details about another person.',
        ],
      },
      {
        heading: 'Your content and moderation',
        paragraphs: [
          'You are responsible for the content you submit and should only upload material you have permission to share. CampusMart may restrict content or account access when needed to protect users or enforce these guidelines.',
        ],
      },
      {
        heading: 'Changes and questions',
        paragraphs: [
          'Feature availability may change as CampusMart is maintained. For help or questions about these guidelines, visit the Campus AI page or contact the CampusMart team through the support channel provided by your campus.',
        ],
      },
    ],
  },
}

function LegalPage({ document: documentName }) {
  const content = documents[documentName]

  return <article className="legal-page">
    <div className="legal-heading">
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p>{content.intro}</p>
    </div>
    <nav className="legal-switcher" aria-label="Policies">
      <Link className={documentName === 'privacy' ? 'is-active' : ''} aria-current={documentName === 'privacy' ? 'page' : undefined} to="/privacy">Privacy</Link>
      <Link className={documentName === 'terms' ? 'is-active' : ''} aria-current={documentName === 'terms' ? 'page' : undefined} to="/terms">Terms</Link>
    </nav>
    <div className="legal-sections">
      {content.sections.map((section) => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
    </div>
    <p className="legal-help">Need help? <Link to="/campus-ai">Visit Campus AI</Link>.</p>
  </article>
}

export default LegalPage
