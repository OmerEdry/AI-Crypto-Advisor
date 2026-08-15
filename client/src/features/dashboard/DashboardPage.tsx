import { DashboardHeader } from './DashboardHeader';
import { SlowRequestBanner } from './SlowRequestBanner';
import { DEFAULT_PLACEMENTS, orderSections, type SectionKey } from './section-order';
import { InsightSection } from './sections/InsightSection';
import { MemeSection } from './sections/MemeSection';
import { NewsSection } from './sections/NewsSection';
import { PricesSection } from './sections/PricesSection';
import { usePreferences } from './use-dashboard-queries';
import type { InvestorType } from '../../types/api';

function renderSection(
  key: SectionKey,
  preferred: boolean,
  investorType: InvestorType | undefined,
) {
  switch (key) {
    case 'prices':
      return <PricesSection preferred={preferred} investorType={investorType} />;
    case 'news':
      return <NewsSection preferred={preferred} />;
    case 'insight':
      return <InsightSection preferred={preferred} />;
    case 'meme':
      return <MemeSection preferred={preferred} />;
  }
}

export default function DashboardPage() {
  const preferences = usePreferences();

  // The order comes from a request of its own, so the first paint cannot know it. Rendering the
  // default order and reordering when preferences land costs a reflow inside a few hundred
  // milliseconds; blocking the page until preferences resolve would cost thirty to sixty
  // seconds of empty screen against a sleeping instance, which is what §9.4 exists to prevent.
  const placements = preferences.data
    ? orderSections(preferences.data.contentTypes)
    : DEFAULT_PLACEMENTS;

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      {/* Sections fetch independently and fail independently (§6.2a), so each one below owns
          its own query rather than reading from a page-level fetch. */}
      <main className="mx-auto max-w-[80rem] space-y-6 px-8 py-8">
        <SlowRequestBanner />
        {placements.map((placement) => (
          <div key={placement.key}>
            {renderSection(placement.key, placement.preferred, preferences.data?.investorType)}
          </div>
        ))}
      </main>
    </div>
  );
}
