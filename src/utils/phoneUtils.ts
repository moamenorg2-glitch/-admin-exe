/**
 * Utility to format phone numbers to E.164 format.
 * Defaults to Egypt (+20) if no country code is provided.
 */
export function formatToE164(phone: string): string {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it already starts with +, return it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Handle Egypt specific formatting
  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }

  // If it starts with 01, it's a mobile number, add +20
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '+20' + cleaned.substring(1);
  }

  // If it starts with 20 and has 12 digits (Egypt full number), add +
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // Fallback: If it's 10 or 11 digits and starts with 1 or 0, prefix with Egypt code
  if (cleaned.length >= 10 && (cleaned.startsWith('1') || cleaned.startsWith('0'))) {
    const withoutZero = cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
    return '+20' + withoutZero;
  }

  // Generic fallback if we can't determine
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}
