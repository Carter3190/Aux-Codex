const restrictedServicePatterns = [
  /\bchiropract(?:ic|or|ors)\b/i,
  /\bhealth[ -]?care\b/i,
  /\bmedical\b/i,
  /\bclinical\b/i,
  /\bphysicians?\b/i,
  /\bdoctors?\b/i,
  /\bnurs(?:e|es|ing)\b/i,
  /\bdent(?:al|ist|ists|istry)\b/i,
  /\bpsychotherap(?:y|ist|ists)\b/i,
  /\b(?:physical|occupational|speech|massage)\s+therap(?:y|ist)\b/i,
  /\b(?:mental|behavioral)\s+health\b/i,
  /\bhome\s+health\b/i,
  /\bpatient\s+care\b/i,
  /\bdiagnos(?:e|es|is|tic|tics)\b/i,
  /\bprescription\b/i,
  /\bacupunctur(?:e|ist|ists)\b/i,
  /\bpharmac(?:y|ist|ists)\b/i,
  /\b(?:surgery|surgeon|surgeons)\b/i,
  /\b(?:ambulance|paramedic|paramedics|emt)\b/i,
  /\b(?:midwife|midwives|doula|doulas)\b/i,
  /\bveterinar(?:y|ian|ians)\b/i,
  /\b(?:primary|urgent|medical|clinical)\s+care\b/i,
  /\bemergency\s+(?:medical|health|clinical|response|care)\b/i,
] as const;

export function isClearlyRestrictedProviderService(
  name: string,
  description: string,
) {
  const serviceText = `${name} ${description}`;
  return restrictedServicePatterns.some((pattern) => pattern.test(serviceText));
}

export const restrictedProviderServiceMessage =
  "Healthcare, chiropractic, medical, clinical, patient-care, and emergency-response services cannot be listed on Auxilium.";
