export const LEGACY_ACTIVATION_COLLECTION = 'activations';

const CAMPAIGN_ACTIVATION_COLLECTION_MAP: Record<string, string> = {
  'spot-money': 'activations_spot',
  spot: 'activations_spot',
  gumtree: 'activations_gumtree'
};

export function getActivationCollectionName(campaignId?: string | null): string {
  if (!campaignId) return LEGACY_ACTIVATION_COLLECTION;
  return CAMPAIGN_ACTIVATION_COLLECTION_MAP[campaignId] || LEGACY_ACTIVATION_COLLECTION;
}

export function getAllActivationCollectionNames(): string[] {
  return ['activations_spot', 'activations_gumtree', LEGACY_ACTIVATION_COLLECTION];
}
