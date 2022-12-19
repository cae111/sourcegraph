// in miliseconds
const units = {
    year: 24 * 60 * 60 * 1000 * 365,
    month: (24 * 60 * 60 * 1000 * 365) / 12,
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000,
} satisfies Partial<Record<Intl.RelativeTimeFormatUnit, number>>

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function getRelativeTime(d1: Date, d2: Date = new Date()): string {
    const elapsed = d1.getTime() - d2.getTime()

    for (const u in units) {
        if (Math.abs(elapsed) > units[u as keyof typeof units]) {
            return rtf.format(Math.round(elapsed / units[u as keyof typeof units]), u as Intl.RelativeTimeFormatUnit)
        }
    }
    return rtf.format(Math.round(elapsed / units['second']), 'second')
}
