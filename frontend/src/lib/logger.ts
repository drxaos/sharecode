const DEBUG = import.meta.env.VITE_DEBUG === 'true'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debug: (...args: any[]) => void = DEBUG ? console.log.bind(console) : () => {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debugWarn: (...args: any[]) => void = DEBUG ? console.warn.bind(console) : () => {}
