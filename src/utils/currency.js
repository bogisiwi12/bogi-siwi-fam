const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
})

export function formatIDR(value) {
  const amount = Number(value) || 0
  const formatted = idrFormatter.format(Math.abs(amount))
  return amount < 0 ? `-${formatted}` : formatted
}
