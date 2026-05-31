const fs = require('fs');

const path = 'src/components/CookDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = {
  'text-slate-400': 'text-slate-600',
  'text-slate-500': 'text-slate-700',
  'text-slate-300': 'text-slate-500',
  'text-white/60': 'text-white/90',
  'text-[7px]': 'text-[10px]',
  'text-[8px]': 'text-[10px]',
  'text-[9px]': 'text-xs',
  'text-[10px]': 'text-sm',
  'text-[11px]': 'text-sm',
  'md:text-[9px]': 'md:text-xs',
  'md:text-[10px]': 'md:text-sm',
  'md:text-xs': 'md:text-sm',
  'md:text-sm': 'md:text-base'
};

// Sort keys by length descending to match longer strings first (e.g. md:text-sm before text-sm if necessary)
const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);

const regex = new RegExp(keys.map(k => k.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")).join('|'), 'g');

content = content.replace(regex, match => replacements[match]);

fs.writeFileSync(path, content);
console.log('Update complete.');
