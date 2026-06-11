export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€',
  CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF',
  INR: '₹', ZAR: 'R',
}
