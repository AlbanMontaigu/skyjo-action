// Minimal inline icon set (stand-in for lucide-react so this app has zero
// npm dependencies), ported 1:1 from the old index.html's Icon components.
// Each function returns an SVG markup string with the same paths as before.

function svgIcon(inner, { size = 18, color = "currentColor", className = "", style = "" } = {}) {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `class="${className}" style="${style}">${inner}</svg>`
  );
}

export const plusIcon = (o) =>
  svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', o);

export const xIcon = (o) =>
  svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', o);

export const trophyIcon = (o) =>
  svgIcon(
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>' +
      '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
      '<path d="M4 22h16"/>' +
      '<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>' +
      '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>' +
      '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    o
  );

export const checkIcon = (o) => svgIcon('<polyline points="20 6 9 17 4 12"/>', o);

export const chevronRightIcon = (o) => svgIcon('<polyline points="9 18 15 12 9 6"/>', o);

export const usersIcon = (o) =>
  svgIcon(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    o
  );

export const flameIcon = (o) =>
  svgIcon(
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    o
  );

export const calculatorIcon = (o) =>
  svgIcon(
    '<rect x="4" y="2" width="16" height="20" rx="2"/>' +
      '<line x1="8" y1="6" x2="16" y2="6"/>' +
      '<line x1="16" y1="14" x2="16" y2="18"/>' +
      '<path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/>' +
      '<path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    o
  );

export const deleteIcon = (o) =>
  svgIcon(
    '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/>' +
      '<line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
    o
  );

export const cameraIcon = (o) =>
  svgIcon(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>' +
      '<circle cx="12" cy="13" r="3"/>',
    o
  );

export const imageIcon = (o) =>
  svgIcon(
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="9.5" r="1.5"/>' +
      '<path d="m21 15-5-5L5 21"/>',
    o
  );

export const loader2Icon = (o) => svgIcon('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', o);

export const keyIcon = (o) =>
  svgIcon(
    '<circle cx="7.5" cy="15.5" r="5.5"/>' +
      '<path d="m21 2-9.6 9.6"/>' +
      '<path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    o
  );

export const pencilIcon = (o) =>
  svgIcon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', o);

export const restartIcon = (o) =>
  svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', o);

export const historyIcon = (o) =>
  svgIcon(
    '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
      '<path d="M3 9h18"/>' +
      '<path d="M8 14h8"/>' +
      '<path d="M8 18h5"/>',
    o
  );
