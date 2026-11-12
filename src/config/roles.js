export const ROLES = ['admin', 'parent', 'child', 'member']

export const BOOTSTRAP_ADMIN_EMAILS = ['bogisiwi12@gmail.com']

export const ROLE_META = {
  admin: { label: 'Admin', icon: '🛡️', badge: 'bg-purple-100 text-purple-600', dot: 'bg-purple-500' },
  parent: { label: 'Parent', icon: '👨‍👩‍👧', badge: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  child: { label: 'Child', icon: '🧒', badge: 'bg-cyan-100 text-cyan-600', dot: 'bg-cyan-500' },
  member: { label: 'Member', icon: '👤', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
}

export function isBootstrapAdmin(email) {
  return !!email && BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase())
}
