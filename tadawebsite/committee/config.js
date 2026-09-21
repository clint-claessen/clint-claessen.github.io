/* TaDa site configuration — shared by the public page (../index.html) and the committee app.
   The Firebase web config is NOT a secret (access is controlled by Firestore security rules),
   so it is fine to commit it here. */
window.TADA_CONFIG = {
  /* Paste the "firebaseConfig" object from Firebase console → Project settings → Your apps → Web app.
     Leave as null until then: the public page then uses data/talks.json only and the committee app shows setup help. */
  firebase: {
    apiKey: "AIzaSyDEnBnS5o9APgp-EkC--oIWlu7qwilbPew",
    authDomain: "tadawebsite.firebaseapp.com",
    projectId: "tadawebsite",
    storageBucket: "tadawebsite.firebasestorage.app",
    messagingSenderId: "295337219808",
    appId: "1:295337219808:web:e27104ee1794870d80a285"
  },
  firebaseVersion: "12.4.0",

  /* Public page links */
  joinUrl: "",       /* optional external sign-up page; empty = the newsletter form on the public page (tada.cool mailing list, IONOS) */
  proposeUrl: "",    /* e.g. a Google Form for talk proposals; empty = mailto fallback */
  blueskyUrl: "",    /* real profile only, e.g. https://bsky.app/profile/tada.bsky.social; empty = Bluesky links hidden */
  linkedinUrl: "",   /* real page only; empty = LinkedIn links hidden */
  termTheme: "AI Tools for Social Scientists",

  /* Mailing list address the newsletter goes to. Messages must be sent FROM the moderator mailbox (team@tada.cool):
     the committee app only opens your e-mail program with the draft and this recipient. */
  newsletterTo: "news@tada.cool",
  /* Webmail of the moderator mailbox: the Newsletter button copies the draft and opens this page in a new tab
     (webmail cannot be prefilled by a link). Set to "" to use the mailto link for a local e-mail program instead. */
  newsletterWebmail: "https://email.ionos.de/",

  /* Organizer roster (names and initials only): always offered as chair / proposer / owner in the committee app,
     even before a person has signed in and created a profile. Profiles that exist take precedence. */
  organizers: [
    { initials: "NB", name: "Nicolai Berk" },
    { initials: "CK", name: "Christopher Klamm" },
    { initials: "VK", name: "Verena Kunz" },
    { initials: "CC", name: "Clint Claessen" }
  ],

  /* Set to false if you never want the public page to read the live programme from Firestore */
  livePublic: true
};
