export const colors = {
  primary: '#087E75',
  primaryDark: '#065E57',
  primarySoft: '#DDF2EF',
  bg: '#F3F8F7',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  danger: '#dc2626',
  blue: '#2563eb',
  amber: '#d97706',
  gray: '#6b7280',
};

export const statusColor: Record<string, string> = {
  New: colors.blue,
  Ready: colors.primary,
  'Picked up': colors.gray,
  Accepted: colors.blue,
  'Awaiting you': colors.amber,
  Preparing: colors.amber,
  Declined: colors.danger,
  Cancelled: colors.danger,
  Expired: colors.gray,
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: {width: 0, height: 2},
  elevation: 2,
};

// for cards that float over the green header
export const shadowLift = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: {width: 0, height: 6},
  elevation: 6,
};
