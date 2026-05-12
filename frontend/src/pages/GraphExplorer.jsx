import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { getCytoscapeStyle } from '../graph/cytoscapeConfig';
import { GraphManager } from '../graph/graphManager';
import { getNeighbors, getRandom, solvePath } from '../api/graphApi';
import { useSettings, getAccent } from '../hooks/useSettings';
import GraphControls from '../components/GraphControls';
import NodeInfo from '../components/NodeInfo';
import StatusBar from '../components/StatusBar';
import HelpModal from '../components/HelpModal';
import SettingsModal from '../components/SettingsModal';

export default function GraphExplorer() {
  const containerRef = useRef(null);
  const cyRef        = useRef(null);
  const managerRef   = useRef(null);

  const [isDark, setIsDark] = useState(() => localStorage.getItem('ia9-theme') !== 'light');
  const [showHelp, setShowHelp]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [solving, setSolving]   = useState(false);
  const [pathActive, setPathActive] = useState(false);
  const [status, setStatus]     = useState('Initializing...');
  const [stats, setStats]       = useState({ nodes: 0, edges: 0, explored: 0 });

  const { settings, update: updateSettings, reset: resetSettings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ── Style sync (theme + settings) ────────────────────────────────────────
  useEffect(() => {
    const accent = getAccent(settings.accentId, isDark);
    document.documentElement.style.setProperty('--blue', accent);
    if (cyRef.current) {
      cyRef.current.style(getCytoscapeStyle(isDark, settings, accent)).update();
    }
  }, [settings, isDark]);

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const handleThemeToggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      localStorage.setItem('ia9-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const syncStats = useCallback(() => {
    if (managerRef.current) setStats(managerRef.current.stats());
  }, []);

  // ── Expand node ───────────────────────────────────────────────────────────
  const expandNode = useCallback(async (id) => {
    const mgr = managerRef.current;
    if (!mgr) return;

    if (mgr.isExplored(id)) {
      setStatus(`${id} — already expanded.`);
      setSelectedNode({ state: id, explored: true, neighborCount: null });
      return;
    }

    setLoading(true);
    setStatus(`Fetching neighbors for ${id}...`);
    try {
      const data = await getNeighbors(id);
      const added = mgr.expandFromNeighbors(id, data.neighbors, settingsRef.current);
      setSelectedNode({ state: id, explored: true, neighborCount: data.total });
      setStatus(`${id} — ${data.total} neighbors, ${added} new nodes added.`);
      syncStats();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [syncStats]);

  // ── Solve ─────────────────────────────────────────────────────────────────
  const handleSolve = useCallback(async () => {
    const mgr = managerRef.current;
    if (!mgr || !selectedNode) return;

    if (pathActive) {
      mgr.clearSolvePath();
      setPathActive(false);
      setStatus('Path cleared.');
      return;
    }

    setSolving(true);
    setStatus(`Solving from ${selectedNode.state}...`);
    try {
      const data = await solvePath(selectedNode.state);
      mgr.highlightSolvePath(data.path.map((p) => p.state), settingsRef.current);
      setPathActive(true);
      setStatus(`Path found — ${data.steps} steps to 1 2 3 / 4 5 6 / 7 8 9.`);
      syncStats();
    } catch (err) {
      setStatus(`Solve error: ${err.message}`);
    } finally {
      setSolving(false);
    }
  }, [selectedNode, pathActive, syncStats]);

  // ── Order graph ───────────────────────────────────────────────────────────
  const handleOrder = useCallback(() => {
    if (!managerRef.current) return;
    setStatus('Ordering graph…');
    managerRef.current.orderGraph(settingsRef.current);
    setStatus('Graph ordered.');
  }, []);

  // ── Random ────────────────────────────────────────────────────────────────
  const handleRandom = useCallback(async () => {
    const mgr = managerRef.current;
    if (!mgr) return;
    try {
      const data = await getRandom();
      if (!mgr.hasNode(data.id)) {
        mgr.addNodeWithSettings(data.id, settingsRef.current);
        syncStats();
      }
      mgr.centerOn(data.id);
      setStatus(`Jumped to ${data.state}.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, [syncStats]);

  const handleFit = useCallback(() => {
    if (cyRef.current) cyRef.current.fit(undefined, 50);
  }, []);

  const handleReset = useCallback(async () => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.reset();
    setSelectedNode(null);
    setPathActive(false);
    syncStats();
    setStatus('Loading new starting node...');
    try {
      const data = await getRandom();
      mgr.addRootNode(data.id);
      syncStats();
      setStatus(`New graph — starting at ${data.state}. Click to explore.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, [syncStats]);

  // ── One-time cy init ──────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    const accent = getAccent(settings.accentId, isDark);
    document.documentElement.style.setProperty('--blue', accent);

    const cy = cytoscape({
      container: containerRef.current,
      style: getCytoscapeStyle(isDark, settings, accent),
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.1,
      maxZoom: 4,
    });

    cyRef.current      = cy;
    managerRef.current = new GraphManager(cy);
    managerRef.current.setupDragRepulsion(() => settingsRef.current);

    getRandom()
      .then((data) => {
        managerRef.current.addRootNode(data.id);
        setStats(managerRef.current.stats());
        setStatus(`Starting at ${data.state}. Click any node to expand its neighbors.`);
      })
      .catch(() => setStatus('Cannot reach backend. Is it running?'));

    return () => { cy.destroy(); cyRef.current = null; managerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tap handler ───────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const handler = (evt) => expandNode(evt.target.id());
    cy.on('tap', 'node', handler);
    return () => cy.removeListener('tap', 'node', handler);
  }, [expandNode]);

  return (
    <div className="explorer">
      <header className="header">
        <div className="header-left">
          <span className="logo">IA-9</span>
          <span className="subtitle">Permutation Graph Explorer</span>
        </div>

        <div className="header-center">
          <NodeInfo node={selectedNode} loading={loading} />
          {selectedNode && (
            <button
              className={`theme-toggle solve-btn${pathActive ? ' active' : ''}`}
              onClick={handleSolve}
              disabled={solving}
            >
              {solving ? 'solving…' : pathActive ? '× path' : 'solve'}
            </button>
          )}
        </div>

        <div className="header-actions">
          <button className="theme-toggle" onClick={() => setShowSettings(true)}>settings</button>
          <button className="theme-toggle" onClick={() => setShowHelp(true)}>guide</button>
          <button className="theme-toggle" onClick={handleThemeToggle}>
            {isDark ? 'light' : 'dark'}
          </button>
        </div>
      </header>

      {showHelp     && <HelpModal onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <SettingsModal
          settings={settings}
          isDark={isDark}
          onUpdate={updateSettings}
          onReset={resetSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="graph-container" ref={containerRef} />

      <footer className="footer">
        <GraphControls
          onRandom={handleRandom}
          onReset={handleReset}
          onFit={handleFit}
          onOrder={handleOrder}
          stats={stats}
        />
        <StatusBar message={status} />
      </footer>
    </div>
  );
}
