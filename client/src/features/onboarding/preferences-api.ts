import { apiRequest } from '../../lib/api-client';
import type { PreferencesInput } from '../../types/api';

// One PUT on completion, not one per step: nothing is persisted until the wizard finishes, so
// there is no partial row to reconcile and no intermediate state the server has to understand.
//
// The response body is ignored rather than parsed. The server echoes the saved row, but what
// the wizard needs next is `hasCompletedOnboarding` from /auth/me — a flag on a different
// resource that this response does not carry.
export async function savePreferences(input: PreferencesInput): Promise<void> {
  await apiRequest('/preferences', { method: 'PUT', body: input });
}
