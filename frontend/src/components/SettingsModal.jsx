import { useEffect } from 'react';
import { DEFAULTS, ACCENT_PRESETS, getAccent } from '../hooks/useSettings';

function Slider({ label, value, min, max, step, unit = '', onChange }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <span>{label}</span>
        <span className="setting-value">{value}{unit}</span>
      </div>
      <input
        className="setting-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function SettingsModal({ settings, isDark, onUpdate, onReset, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          <div className="modal-section">
            <h3>Graph Layout</h3>
            <Slider
              label="Node spacing"
              value={settings.nodeSpacing}
              min={20} max={200} step={10} unit="px"
              onChange={(v) => onUpdate({ nodeSpacing: v })}
            />
            <Slider
              label="Node size"
              value={settings.nodeSize}
              min={50} max={120} step={2} unit="px"
              onChange={(v) => onUpdate({ nodeSize: v })}
            />
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <h3>Visual</h3>
            <Slider
              label="Edge opacity"
              value={settings.edgeOpacity}
              min={0.05} max={1} step={0.05}
              onChange={(v) => onUpdate({ edgeOpacity: v })}
            />
            <Slider
              label="Pan speed"
              value={settings.panDuration}
              min={100} max={900} step={50} unit="ms"
              onChange={(v) => onUpdate({ panDuration: v })}
            />
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <h3>Accent Color</h3>
            <div className="accent-swatches">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`accent-swatch${settings.accentId === p.id ? ' active' : ''}`}
                  style={{ '--swatch': getAccent(p.id, isDark) }}
                  title={p.label}
                  onClick={() => onUpdate({ accentId: p.id })}
                />
              ))}
            </div>
          </div>

          <div className="modal-divider" />

          <div className="modal-section">
            <button className="btn-reset" onClick={onReset}>Reset to defaults</button>
          </div>

        </div>
      </div>
    </div>
  );
}
