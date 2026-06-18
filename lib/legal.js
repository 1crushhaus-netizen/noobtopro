// ---------------------------------------------------------------------------
// Single source of truth for the operator + legal-entity details referenced across the
// public legal pages (/privacy, /terms, /refunds, /cookies, /aup, /accessibility, /legal/*).
// Editing a value here updates every page.
//
// Operator: a German sole proprietorship (Einzelunternehmen), currently pre-registration and
// pre-revenue — so the registered address, commercial-register entry, and VAT ID are shown as
// "to be added" placeholders until registration with the German authorities completes. These
// pages are a good-faith starting point and have not been reviewed by qualified legal counsel;
// review is recommended before relying on them, and the bracketed items must be completed.
// ---------------------------------------------------------------------------

export const LEGAL = {
  siteName: "noobtopro",
  domain: "https://noobto.pro",
  domainBare: "noobto.pro",

  // The operator (a German Einzelunternehmen, run by one person).
  operatorName: "Russell Rozario",
  businessName: "noobtopro",
  businessForm: "sole proprietorship (Einzelunternehmen) under German law",
  city: "Cologne (Köln)",
  region: "North Rhine-Westphalia",
  country: "Germany",

  // Filled once the business is registered with the German authorities.
  address: "[Registered business address — to be added upon registration]",
  registrationNote:
    "noobtopro is operated as a sole proprietorship (Einzelunternehmen) and is not yet entered in the commercial register (Handelsregister). Registration details will be added here once available.",
  vatId: "[VAT identification number (USt-IdNr.) — to be added if/when VAT-registered]",

  // All business and support communications.
  contactEmail: "russellrozario@noobto.pro",

  // Governing law / venue (German law; mandatory consumer protections of the consumer's
  // country of residence are preserved — see the Terms).
  governingLaw: "the laws of the Federal Republic of Germany",
  venueCity: "Cologne, Germany",

  // Lead data-protection supervisory authority (the operator is based in NRW).
  supervisoryAuthority:
    "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf, Germany",

  // Payments — Merchant of Record (the seller of record for Pro).
  mor: "Polar",
  morEntity: "Polar Software, Inc.",
  morSite: "https://polar.sh",

  lastUpdated: "18 June 2026",
};

export default LEGAL;
