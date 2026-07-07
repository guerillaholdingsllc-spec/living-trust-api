const states = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
];

const special = {
  CA: "California variation should flag community property, transfer deed handling, Proposition 19 property tax issues, and homestead considerations.",
  TX: "Texas variation should flag community property, homestead protections, independent administration norms, and mineral or business interests.",
  FL: "Florida variation should flag strict witness and notary execution requirements, homestead devise limits, and elective share issues.",
  LA: "Louisiana variation should flag civil law terminology, forced heirship issues, and attorney drafting review as mandatory before use.",
  NY: "New York variation should flag EPTL execution customs, trust funding through real-property instruments, and fiduciary powers review."
};

const witnessNotary = {
  FL: "Grantor signature, two witnesses, and notarization required for trust execution best practice and related will execution.",
  NH: "Grantor signature with notarization; two witnesses may be required for related estate documents.",
  OH: "Grantor signature with notarization; two witnesses may be required for related estate documents."
};

const registrationStates = new Set(["AK", "CO", "HI", "ID", "ME", "MI", "NE", "ND"]);

export const STATE_RULES = Object.fromEntries(states.map(([code, name]) => [code, {
  code,
  name,
  executionRequirements: witnessNotary[code] || "Grantor signature before a notary; attorney should confirm witness requirements for related documents.",
  trustRegistration: registrationStates.has(code),
  rufadaa: "Digital fiduciary access language included under RUFADAA or comparable state law.",
  clauseVariation: special[code] || `${name} attorney-maintained variation for revocable trust powers, trustee succession, spendthrift protection, no-contest enforceability, execution, funding, and state tax or property rules.`
}]));
