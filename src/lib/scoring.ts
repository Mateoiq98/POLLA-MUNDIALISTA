export function calculatePoints(
  predLocal: number,
  predVisit: number,
  realLocal: number,
  realVisit: number
): number {
  const predDiff = predLocal - predVisit;
  const realDiff = realLocal - realVisit;
  const diffDiff = Math.abs(predDiff - realDiff);

  const predSign = predDiff > 0 ? 1 : predDiff < 0 ? -1 : 0;
  const realSign = realDiff > 0 ? 1 : realDiff < 0 ? -1 : 0;

  if (predLocal === realLocal && predVisit === realVisit) {
    return 5;
  }

  if (predSign === realSign && diffDiff === 1) {
    return 4;
  }

  if (predSign !== realSign && diffDiff === 1) {
    return 1;
  }

  return 0;
}

export function getPointsLabel(points: number): string {
  switch (points) {
    case 5:
      return "Pleno";
    case 4:
      return "Acierto + Margen";
    case 1:
      return "Consuelo";
    default:
      return "Sin puntos";
  }
}
