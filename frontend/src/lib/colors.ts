export const COLORS = [
  '#e63946',
  '#f4a261',
  '#2a9d8f',
  '#457b9d',
  '#6a4c93',
  '#e76f51',
  '#52b788',
  '#4cc9f0',
  '#f72585',
  '#b5838d',
  '#3a86ff',
  '#e9c46a',
]

export function getColor(clientID: number): string {
  return COLORS[Math.abs(clientID) % COLORS.length]
}
