export default function GraphControls({ onRandom, onReset, onFit, onOrder, stats }) {
  return (
    <div className="controls">
      <button onClick={onRandom}>+ Random</button>
      <button onClick={onFit}>Fit</button>
      <button onClick={onOrder}>Order</button>
      <button className="danger" onClick={onReset}>Reset</button>
      <div className="stats">
        <span><strong>{stats.nodes}</strong> nodes</span>
        <span><strong>{stats.edges}</strong> edges</span>
        <span><strong>{stats.explored}</strong> explored</span>
      </div>
    </div>
  );
}
