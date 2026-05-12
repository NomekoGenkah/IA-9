import { useEffect } from 'react';

export default function HelpModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">IA-9 — Guide</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          <div className="modal-section">
            <h3>What is this?</h3>
            <p>
              IA-9 is a state-space graph explorer. Each node represents a unique
              permutation of the digits 1–9 (e.g. <span className="modal-kbd">3 6 2 8 4 1 9 5 7</span>).
              Edges connect permutations reachable from one another by swapping two
              adjacent digits — one swap, one step.
            </p>
            <p style={{ marginTop: 6 }}>
              The full graph has <strong>362,880</strong> nodes. It is never loaded upfront.
              You explore it on demand, one expansion at a time.
            </p>
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <h3>How to explore</h3>
            <ul>
              <li>
                <strong>Click any node</strong> to expand it — its 8 neighbors appear
                arranged around it and the view smoothly pans to follow.
              </li>
              <li>
                Nodes with a <strong>dashed border</strong> are known but not yet expanded.
                Solid-border nodes have been explored.
              </li>
              <li>
                <strong>+ Random</strong> drops a new unexplored node near the current view.
              </li>
              <li>
                <strong>Fit</strong> re-centers the viewport to show all visible nodes.
              </li>
              <li>
                <strong>Reset</strong> clears the graph and starts from a new random seed.
              </li>
            </ul>
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <h3>Navigation</h3>
            <ul>
              <li>
                <span className="modal-kbd">scroll</span> to zoom in / out.
              </li>
              <li>
                <span className="modal-kbd">drag</span> on empty canvas to pan.
              </li>
              <li>
                <span className="modal-kbd">Esc</span> to close this panel.
              </li>
            </ul>
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <h3>Transition rule</h3>
            <p>
              Two states are neighbors if one can be reached from the other by a
              single adjacent swap. For the state <span className="modal-kbd">1 2 3 4 5 6 7 8 9</span>,
              the 8 neighbors are all permutations obtained by swapping positions
              (0,1), (1,2), (2,3) … (7,8).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
