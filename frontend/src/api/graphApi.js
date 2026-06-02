// Self-contained, no backend. All computation runs locally in the browser so
// the app can be served as a static site (e.g. GitHub Pages).
// Kept async with the original signatures so call sites stay unchanged.
import { solvePath as solveLocal } from '../graph/solve';
import { UNIVERSE_META } from '../graph/universe';

export const solvePath   = (id) => Promise.resolve(solveLocal(id));
export const getUniverse = ()   => Promise.resolve(UNIVERSE_META);
