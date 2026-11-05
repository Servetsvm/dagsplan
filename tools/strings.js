// lists the English texts given to T() that a language in js/lang.js has no translation for: node tools/strings.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const set = new Set(['School', 'Training', 'Home', 'Family', 'Other', 'Sound', 'Voice message', 'Silent (screen only)', 'No reminder', 'Once', 'Every day', 'Every week',
  'Brush your teeth', 'Get dressed', 'Eat breakfast', 'Take your medicine', 'Books', 'Pencil case', 'Packed lunch', 'Laptop', 'Water bottle', 'Swimsuit', 'Goggles', 'Shampoo', 'Towel',
  'Get up', 'Breakfast', 'Pack the school bag', 'Homework', 'Swimming', 'Dinner', 'Screen off', 'Bedtime']);
for (const f of ['core', 'child', 'parent', 'call', 'ntfy', 'app']) for (const m of fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8').matchAll(/T\('((?:[^'\\]|\\.)*)'/g)) set.add(m[1]);
let I18N = {}; try { I18N = new Function(fs.readFileSync(path.join(root, 'js/lang.js'), 'utf8') + ';return I18N')(); } catch (e) {}
for (const l of ['nb', 'tr']) { const miss = [...set].filter(s => !(I18N[l] || {})[s]); console.log(l + ': ' + miss.length + ' missing'); miss.forEach(s => console.log('  ' + s)); }
