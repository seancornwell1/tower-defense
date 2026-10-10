import { CFG, getPath, listPaths, defaultValue, setValue, resetAll, overrides, importOverrides } from './config';

// Hidden tuning panel: a plain DOM overlay so number inputs work with the
// iPhone keyboard. Opened by triple-tapping the top-left corner in game.

let panel: HTMLDivElement | null = null;

const css = `
#tuning{position:fixed;inset:0;z-index:50;background:rgba(15,17,22,.96);color:#e8e8e8;
  font:14px -apple-system,system-ui,sans-serif;display:flex;flex-direction:column;
  padding:calc(env(safe-area-inset-top) + 8px) 12px calc(env(safe-area-inset-bottom) + 8px)}
#tuning .bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
#tuning button{font:inherit;font-weight:600;padding:10px 12px;border:0;border-radius:8px;background:#3a3f4b;color:#fff}
#tuning button.primary{background:#2f7d4f}
#tuning button.danger{background:#7d2f2f}
#tuning input[type=search]{width:100%;font-size:16px;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;margin-bottom:8px;box-sizing:border-box}
#tuning .list{overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch}
#tuning h4{margin:14px 0 4px;color:#9fc4ff;text-transform:uppercase;font-size:12px;letter-spacing:.08em}
#tuning .row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #2a2d35}
#tuning .row label{flex:1;word-break:break-all}
#tuning .row.changed label{color:#ffd166}
#tuning .row input{width:120px;font-size:16px;padding:6px;border-radius:6px;border:1px solid #555;background:#1c1e24;color:#fff}
#tuning .row small{color:#888;width:56px;text-align:right}
#tuning textarea{width:100%;height:120px;font:12px monospace;background:#111;color:#cfc;border:1px solid #555;box-sizing:border-box}
`;

function parse(raw: string, like: number | number[]): number | number[] | null {
  if (Array.isArray(like)) {
    const parts = raw.split(',').map((s) => Number(s.trim()));
    return parts.every((n) => Number.isFinite(n)) ? parts : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function openTuning(onApply: () => void, onClose: () => void): void {
  if (panel) return;
  if (!document.getElementById('tuning-css')) {
    const style = document.createElement('style');
    style.id = 'tuning-css';
    style.textContent = css;
    document.head.appendChild(style);
  }
  panel = document.createElement('div');
  panel.id = 'tuning';
  panel.innerHTML = `
    <div class="bar">
      <button class="primary" data-act="apply">Apply &amp; restart stage</button>
      <button data-act="close">Close</button>
      <button data-act="export">Export / import</button>
      <button class="danger" data-act="reset">Reset all</button>
    </div>
    <div class="io" style="display:none">
      <p>Changed values (copy to share, or paste and tap Import):</p>
      <textarea></textarea>
      <div class="bar"><button data-act="import">Import</button></div>
    </div>
    <input type="search" placeholder="Filter (e.g. rocket, hp, cost)">
    <div class="list"></div>`;
  document.body.appendChild(panel);

  const list = panel.querySelector('.list') as HTMLDivElement;
  const filter = panel.querySelector('input[type=search]') as HTMLInputElement;
  const io = panel.querySelector('.io') as HTMLDivElement;
  const ta = panel.querySelector('textarea') as HTMLTextAreaElement;

  const render = () => {
    const q = filter.value.trim().toLowerCase();
    list.innerHTML = '';
    let group = '';
    for (const path of listPaths()) {
      if (q && !path.toLowerCase().includes(q)) continue;
      const g = path.split('.').slice(0, -1).join('.');
      if (g !== group) {
        group = g;
        const h = document.createElement('h4');
        h.textContent = g;
        list.appendChild(h);
      }
      const value = getPath(CFG, path);
      const def = defaultValue(path);
      const row = document.createElement('div');
      row.className = 'row' + (JSON.stringify(value) !== JSON.stringify(def) ? ' changed' : '');
      const label = document.createElement('label');
      label.textContent = path.split('.').pop()!;
      const input = document.createElement('input');
      input.value = Array.isArray(value) ? value.join(', ') : String(value);
      input.inputMode = Array.isArray(value) ? 'text' : 'decimal';
      input.addEventListener('change', () => {
        const parsed = parse(input.value, def);
        if (parsed === null) {
          input.style.borderColor = '#e55';
          return;
        }
        input.style.borderColor = '';
        setValue(path, parsed);
        row.className = 'row' + (JSON.stringify(parsed) !== JSON.stringify(def) ? ' changed' : '');
      });
      const small = document.createElement('small');
      small.textContent = Array.isArray(def) ? '' : String(def);
      row.append(label, input, small);
      list.appendChild(row);
    }
  };
  filter.addEventListener('input', render);
  render();

  panel.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset?.act;
    if (!act) return;
    if (act === 'apply') { close(); onApply(); }
    else if (act === 'close') { close(); onClose(); }
    else if (act === 'reset') {
      if (confirm('Reset every value to its default?')) { resetAll(); render(); }
    } else if (act === 'export') {
      io.style.display = io.style.display === 'none' ? 'block' : 'none';
      ta.value = JSON.stringify(overrides(), null, 1);
    } else if (act === 'import') {
      try { importOverrides(ta.value); render(); } catch { alert('Could not read that JSON.'); }
    }
  });
}

function close(): void {
  panel?.remove();
  panel = null;
}
