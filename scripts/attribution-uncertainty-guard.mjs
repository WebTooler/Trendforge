const UNCERTAINTY_MARKERS=/\b(?:may|might|could|can|possible|possibly|potentially|expected|expects|likely|unlikely|appears|appeared|reportedly|alleged|allegedly|projected|forecast|estimated|suggests|suggested)\b/i;
const CERTAINTY_MARKERS=/\b(?:will|is|are|was|were|has|have|proves|proven|guarantees|guaranteed|confirms|confirmed|definitely|certainly|clearly)\b/i;
const ATTRIBUTION_MARKERS=/\b(?:according to|said|says|reported|reports|announced|told|argued|noted|acknowledged|found|the report|the study|officials?)\b/i;
export function assessAttributionUncertainty(claim='',evidence=''){
  const c=String(claim),e=String(evidence);
  const evidenceUncertain=UNCERTAINTY_MARKERS.test(e);
  const claimUncertain=UNCERTAINTY_MARKERS.test(c);
  const evidenceAttributed=ATTRIBUTION_MARKERS.test(e);
  const claimAttributed=ATTRIBUTION_MARKERS.test(c);
  const certaintyEscalation=evidenceUncertain&&!claimUncertain&&CERTAINTY_MARKERS.test(c);
  const attributionDropped=evidenceAttributed&&!claimAttributed&&evidenceUncertain&&!claimUncertain;
  return {evidenceUncertain,claimUncertain,evidenceAttributed,claimAttributed,certaintyEscalation,attributionDropped,blocked:certaintyEscalation||attributionDropped};
}
