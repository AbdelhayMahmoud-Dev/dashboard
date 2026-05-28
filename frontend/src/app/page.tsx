// Root redirects to dashboard — skip static generation to avoid workStore invariant.
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
