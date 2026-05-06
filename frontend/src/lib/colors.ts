// Expanded palette – 20 high‑contrast colors (d3‑schemeCategory20c)
// These colors are visually distinct even when many users join the same room.

export const COLORS = [
  // 20 distinct colors (d3‑schemeCategory20c)
  '#1f77b4', // muted blue
  '#ff7f0e', // safety orange
  '#2ca02c', // cooked asparagus green
  '#d62728', // brick red
  '#9467bd', // muted purple
  '#8c564b', // chestnut brown
  '#e377c2', // raspberry yogurt pink
  '#7f7f7f', // middle gray
  '#bcbd22', // curry yellow‑green
  '#17becf', // blue‑teal
  '#aec7e8', // light blue
  '#ffbb78', // light orange
  '#98df8a', // light green
  '#ff9896', // light red
  '#c5b0d5', // light purple
  '#c49c94', // light brown
  '#f7b6d2', // pink‑lavender
  '#c7c7c7', // light gray
  '#dbdb8d', // light olive
  '#9edae5', // light cyan
];

export function getColor(clientID: number): string {
  return COLORS[Math.abs(clientID) % COLORS.length]
}
