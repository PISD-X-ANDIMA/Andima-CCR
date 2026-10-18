// Position IDs saved by registration; department does not determine the dashboard.
export function getLoginDestination(positionId: string | null | undefined): string | null {
  switch (positionId) {
    case '0ec333af-8737-413f-adab-841a3067e485': // Director
      return '/dashboard';
    case '265c9357-105c-437c-a244-6897122f17c1': // Information Technology
      return '/smki/dashboard';
    default:
      return null;
  }
}
