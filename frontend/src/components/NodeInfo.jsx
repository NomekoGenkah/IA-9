function Matrix({ state }) {
  return (
    <div className="node-matrix">
      {[0, 3, 6].map((offset) => (
        <div key={offset} className="node-matrix-row">
          {[0, 1, 2].map((col) => (
            <span key={col} className="node-matrix-cell">{state[offset + col]}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function NodeInfo({ node, loading }) {
  if (loading) return <span className="node-status loading">expanding...</span>;
  if (!node)   return <span className="node-status hint">click a node to explore</span>;

  return (
    <div className="node-info">
      <Matrix state={node.state} />
      {node.explored ? (
        <span className="badge explored">{node.neighborCount} neighbors</span>
      ) : (
        <span className="badge unexplored">unexplored</span>
      )}
    </div>
  );
}
