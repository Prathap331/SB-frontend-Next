'use client';

import { useState } from 'react';
import PricingCard from './PricingCard';
import { pricingPlans } from './pricingPlans';

export default function PricingGrid() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const defaultIndex = pricingPlans.findIndex(p => p.popular);

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {pricingPlans.map((plan, index) => (
        <PricingCard
          key={plan.name}
          plan={plan}
          isHighlighted={hoveredIndex === null ? index === defaultIndex : hoveredIndex === index}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  );
}