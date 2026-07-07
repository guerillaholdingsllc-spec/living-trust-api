import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateTrustPackage(input) {
  if (!openai) return localDraft(input);

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            "You draft attorney-review-ready estate planning documents from structured user input.",
            "Do not provide legal advice. Include UPL disclaimers and attorney review notes.",
            "Return complete, populated documents only. Include RUFADAA digital assets language.",
            "Respect the supplied state execution requirements and clause variation notes."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "trust_package",
          strict: true,
          schema: packageSchema
        }
      }
    });

    return JSON.parse(response.output_text);
  } catch (error) {
    console.warn(`OpenAI trust generation unavailable; using local draft fallback: ${error.message}`);
    return localDraft(input);
  }
}

export async function generateIntakeGuidance(input) {
  if (!openai) return localIntakeGuidance(input);

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            "You are an estate-document intake assistant for document preparation software.",
            "Do not give legal advice. Help the user complete factual intake clearly.",
            "Return concise JSON with missing fields, plain-English guidance, risk flags, and next best action."
          ].join(" ")
        },
        { role: "user", content: JSON.stringify(input) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "intake_guidance",
          strict: true,
          schema: intakeGuidanceSchema
        }
      }
    });

    return JSON.parse(response.output_text);
  } catch (error) {
    console.warn(`OpenAI intake guidance unavailable; using local guidance fallback: ${error.message}`);
    return localIntakeGuidance(input);
  }
}

export async function generateAttorneyReviewPacket(input) {
  if (!openai) return localAttorneyReviewPacket(input);

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            "You prepare attorney review packets for living trust document workflows.",
            "Summarize facts, missing information, state issues, drafting risks, and approval checklist.",
            "Do not provide legal advice to consumers; this output is for licensed reviewer triage."
          ].join(" ")
        },
        { role: "user", content: JSON.stringify(input) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "attorney_review_packet",
          strict: true,
          schema: attorneyReviewPacketSchema
        }
      }
    });

    return JSON.parse(response.output_text);
  } catch (error) {
    console.warn(`OpenAI review packet unavailable; using local review fallback: ${error.message}`);
    return localAttorneyReviewPacket(input);
  }
}

export async function generateLeadBrief(input) {
  if (!openai) return localLeadBrief(input);

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            "You are a growth operator for an attorney-reviewed living trust SaaS.",
            "Create ethical lead research plans, channel ideas, outreach drafts, and market monitoring notes.",
            "Never recommend spam, deception, unauthorized practice of law, or scraping behind logins."
          ].join(" ")
        },
        { role: "user", content: JSON.stringify(input) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lead_brief",
          strict: true,
          schema: leadBriefSchema
        }
      }
    });

    return JSON.parse(response.output_text);
  } catch (error) {
    console.warn(`OpenAI lead brief unavailable; using local lead fallback: ${error.message}`);
    return localLeadBrief(input);
  }
}

const packageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["trustDocument", "pourOverWill", "certificateOfTrust", "fundingInstructions", "attorneyReviewChecklist"],
  properties: {
    trustDocument: { type: "string" },
    pourOverWill: { type: "string" },
    certificateOfTrust: { type: "string" },
    fundingInstructions: { type: "string" },
    attorneyReviewChecklist: { type: "array", items: { type: "string" } }
  }
};

const intakeGuidanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["completionScore", "missingFields", "riskFlags", "assistantMessage", "nextBestAction"],
  properties: {
    completionScore: { type: "number" },
    missingFields: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    assistantMessage: { type: "string" },
    nextBestAction: { type: "string" }
  }
};

const attorneyReviewPacketSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "stateIssues", "missingInfo", "riskFlags", "reviewChecklist", "customerFollowUpDraft"],
  properties: {
    summary: { type: "string" },
    stateIssues: { type: "array", items: { type: "string" } },
    missingInfo: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    reviewChecklist: { type: "array", items: { type: "string" } },
    customerFollowUpDraft: { type: "string" }
  }
};

const leadBriefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["market", "bestChannels", "leadSignals", "outreachDrafts", "experiments", "dailyProtocol"],
  properties: {
    market: { type: "string" },
    bestChannels: { type: "array", items: { type: "string" } },
    leadSignals: { type: "array", items: { type: "string" } },
    outreachDrafts: { type: "array", items: { type: "string" } },
    experiments: { type: "array", items: { type: "string" } },
    dailyProtocol: { type: "array", items: { type: "string" } }
  }
};

function localDraft(input) {
  const { grantor, clauses, assets, stateRules } = input;
  const assetSchedule = assets.length
    ? assets.map((asset) => `${asset.type || "Asset"}: ${asset.description || "details pending"}`).join("; ")
    : "To be completed during funding.";
  const disclaimer = "UPL DISCLAIMER: This document package was prepared by document automation software from user input. It is not legal advice and must be reviewed by a licensed attorney before use.";
  const rufadaa = "DIGITAL ASSETS AND RUFADAA: The trustee is authorized, to the fullest extent permitted by the Revised Uniform Fiduciary Access to Digital Assets Act as adopted or recognized in the applicable jurisdiction, to access, manage, preserve, transfer, and close digital accounts and digital assets, including cryptocurrency, domain names, online businesses, stored files, email records, and electronically stored information.";
  return {
    trustDocument: [
      disclaimer,
      `REVOCABLE LIVING TRUST OF ${grantor.fullName.toUpperCase()}`,
      `Governing jurisdiction: ${stateRules.name}. Execution requirements: ${stateRules.executionRequirements}.`,
      `State clause variation: ${stateRules.clauseVariation}.`,
      "The Grantor declares this revocable living trust and transfers scheduled trust property to the acting trustee to be administered for the beneficiaries according to the completed questionnaire.",
      `Included clauses: ${clauses.join(", ") || "standard revocable living trust clauses"}.`,
      rufadaa,
      `Asset schedule: ${assetSchedule}`,
      "Attorney review is required before signing, notarization, funding, or reliance."
    ].join("\n\n"),
    pourOverWill: `${disclaimer}\n\nPOUR-OVER WILL OF ${grantor.fullName.toUpperCase()}\n\nAll probate assets not previously transferred to the revocable living trust shall pour over into that trust, subject to state law and attorney review.`,
    certificateOfTrust: `${disclaimer}\n\nCERTIFICATE OF TRUST\n\nGrantor: ${grantor.fullName}\nState: ${stateRules.name}\nThis certificate summarizes the existence of the trust for financial institutions without disclosing private dispositive terms.`,
    fundingInstructions: `${disclaimer}\n\nFUNDING INSTRUCTIONS\n\nReview the asset schedule before signing: ${assetSchedule}\n\nRetitle real estate, bank and cash accounts, taxable brokerage accounts, business interests, vehicles, jewelry or valuables where appropriate, and digital asset access records into or for the benefit of the trust as allowed by each institution and ${stateRules.name} law. Retirement accounts and life insurance usually rely on beneficiary designations rather than direct trust funding; attorney review is required before naming the trust as beneficiary. Firearms, NFA items, restricted assets, out-of-state real estate, and business interests may require separate legal transfer steps. Attorney-reviewed deeds, assignments, beneficiary forms, titles, and institution-specific forms may be required.`,
    attorneyReviewChecklist: [
      "Confirm state-specific execution requirements.",
      "Confirm beneficiary and trustee names.",
      "Confirm RUFADAA and digital asset language.",
      "Confirm real estate, bank, brokerage, retirement, insurance, vehicle, business, firearms, jewelry, and digital asset handling.",
      "Confirm beneficiary designations, excluded assets, and special transfer restrictions.",
      "Confirm community property, homestead, elective share, and trust registration issues where applicable."
    ]
  };
}

function localIntakeGuidance(input) {
  const { form = {}, selectedClauses = [], stateRules } = input;
  const assetKeys = [
    ["realEstate", "Real estate"],
    ["bankAccounts", "Bank and cash accounts"],
    ["investmentAccounts", "Stocks, bonds, or brokerage accounts"],
    ["retirementAccounts", "Retirement accounts"],
    ["lifeInsurance", "Life insurance"],
    ["vehicles", "Cars, boats, RVs, or titled vehicles"],
    ["businessInterests", "Business interests"],
    ["firearms", "Firearms or regulated property"],
    ["jewelryValuables", "Jewelry, collectibles, or valuables"],
    ["digitalAssets", "Digital assets or online accounts"],
    ["debtsLiabilities", "Debts or liens"],
    ["safeDepositStorage", "Safe deposit boxes or original document locations"]
  ];
  const answeredAssetCategories = assetKeys.filter(([key]) => String(form[key] || "").trim());
  const required = [
    ["fullName", "Grantor full name"],
    ["email", "Email"],
    ["successorTrustee", "Successor trustee"],
    ["beneficiaries", "Beneficiaries"],
    ["distributionPlan", "Distribution plan"],
    ["assetSummary", "Asset overview"],
    ["beneficiaryDesignations", "Beneficiary-designation check"]
  ];
  const missingFields = required.filter(([key]) => !String(form[key] || "").trim()).map(([, label]) => label);
  if (answeredAssetCategories.length < 4) {
    missingFields.push("More asset categories, such as real estate, accounts, insurance, vehicles, valuables, or digital assets");
  }
  const riskFlags = [];
  if (!String(form.successorTrustee || "").trim()) riskFlags.push("No successor trustee named yet.");
  if (!String(form.assetSummary || "").trim()) riskFlags.push("Trust funding may fail if assets are not inventoried.");
  if (!String(form.beneficiaryDesignations || "").trim()) riskFlags.push("Beneficiary designations for life insurance, retirement, POD, TOD, and brokerage accounts still need review.");
  if (String(form.firearms || "").trim()) riskFlags.push("Firearms or regulated property may require state-specific transfer and storage review.");
  if (String(form.businessInterests || "").trim()) riskFlags.push("Business interests may require operating agreement, buy-sell, assignment, or consent review.");
  if (String(form.retirementAccounts || "").trim() || String(form.lifeInsurance || "").trim()) riskFlags.push("Retirement and life insurance assets often transfer by beneficiary designation, not simple retitling.");
  if (selectedClauses.includes("Special Needs Clause")) riskFlags.push("Special needs planning should receive attorney attention before signing.");
  if (stateRules?.trustRegistration) riskFlags.push(`${stateRules.name} may require or commonly involve trust registration review.`);
  return {
    completionScore: Math.max(10, Math.min(100, Math.round((((required.length - missingFields.length) / required.length) * 70) + ((answeredAssetCategories.length / assetKeys.length) * 30)))),
    missingFields,
    riskFlags,
    assistantMessage: missingFields.length
      ? `You are close. Add ${missingFields.slice(0, 3).join(", ")} so the drafting package has enough facts for attorney review.`
      : "The intake has the core facts needed for draft generation. Review names, spelling, trustee sequence, and asset details before payment.",
    nextBestAction: missingFields[0] || "Generate the draft package and continue to payment."
  };
}

function localAttorneyReviewPacket(input) {
  const trust = input.trust || {};
  const form = trust.form_json || {};
  const stateRules = input.stateRules || {};
  const questionnaire = form.questionnaire || {};
  return {
    summary: `${trust.grantor_name || "Grantor"} submitted a ${questionnaire.trustType || "revocable living trust"} package for ${stateRules.name || trust.state || "state"} review.`,
    stateIssues: [
      stateRules.executionRequirements || "Confirm execution requirements.",
      stateRules.clauseVariation || "Confirm state clause variations."
    ],
    missingInfo: [
      !questionnaire.successorTrustee && "Successor trustee details need confirmation.",
      !questionnaire.beneficiaries && "Beneficiary names and relationships need confirmation.",
      !(form.assets || []).length && "Asset schedule needs confirmation before funding.",
      !questionnaire.beneficiaryDesignations && "Beneficiary designations need confirmation for insurance, retirement, POD, TOD, and brokerage accounts.",
      !questionnaire.excludedAssets && "Assets excluded from the trust or handled separately need confirmation."
    ].filter(Boolean),
    riskFlags: [
      "Confirm capacity, identity, intent, and absence of undue influence.",
      "Confirm homestead, community property, elective share, tax, and deed-transfer issues where relevant.",
      "Review real estate, stocks, bonds, bank accounts, retirement accounts, life insurance, cars, firearms, jewelry, business interests, debts, safe deposit boxes, and digital assets for proper funding or beneficiary handling."
    ],
    reviewChecklist: [
      "Review grantor and beneficiary names.",
      "Review trustee succession and removal terms.",
      "Review no-contest, spendthrift, incapacity, and digital asset clauses.",
      "Review signing, notary, witness, and funding instructions.",
      "Approve, request changes, or reject with notes."
    ],
    customerFollowUpDraft: `Hello ${trust.grantor_name || "there"}, we are reviewing your trust package. Please confirm that your trustee names, beneficiary names, and asset list are complete and spelled correctly.`
  };
}

function localLeadBrief(input) {
  const market = input.market || "United States";
  const audience = input.audience || "homeowners, parents, business owners, and families planning for probate avoidance";
  return {
    market,
    bestChannels: [
      `State-specific SEO pages for living trust, probate avoidance, and trust funding searches in ${market}.`,
      "Referral partnerships with financial advisors, CPAs, real estate agents, mortgage brokers, and senior-service providers.",
      "Retargeting and email follow-up for people who start but do not finish the intake."
    ],
    leadSignals: [
      "Home purchase, new child, marriage, divorce, relocation, business formation, elder-care planning, probate questions, or digital-asset ownership.",
      "Search intent around living trust cost, will vs trust, avoiding probate, certificate of trust, and how to fund a trust.",
      "Advisor clients asking for estate document readiness before tax, retirement, or property planning."
    ],
    outreachDrafts: [
      `Hi, I noticed your clients in ${market} often need a simple way to get estate documents organized before attorney review. LivingTrust Pro gives them a guided intake, trust package, funding instructions, and review workflow.`,
      `Quick idea for ${audience}: offer a free trust-readiness checklist, then route qualified clients into a reviewed living trust package instead of leaving them with generic templates.`
    ],
    experiments: [
      "Launch one state landing page and one checklist lead magnet.",
      "Test $297, $397, and $497 price framing.",
      "Create a weekly partner email for advisors with plain-English trust education."
    ],
    dailyProtocol: [
      "Check yesterday's starts, completions, payments, and abandoned intakes.",
      "Send follow-up drafts for abandoned high-intent users.",
      "Review competitor pricing and new estate-planning content.",
      "Add one new partner prospect list and one plain-English education asset."
    ]
  };
}
