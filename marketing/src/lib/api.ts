const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta.env.PUBLIC_API_URL || import.meta.env.VITE_API_URL)) ||
  'http://localhost:3000';

export interface DeliveryCheckResult {
  deliverable: boolean;
  serviceable: boolean;
  pincode: string;
  city?: string;
  state?: string;
}

export async function checkDeliveryPincode(pincode: string): Promise<DeliveryCheckResult> {
  const cleanPincode = pincode.trim();
  const url = `${API_BASE_URL}/address/check-delivery?pincode=${encodeURIComponent(cleanPincode)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check pincode: HTTP ${response.status}`);
  }

  return response.json();
}
