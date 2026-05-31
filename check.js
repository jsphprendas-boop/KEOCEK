const fs = require('fs');

const content = fs.readFileSync('src/components/CookDashboard.tsx', 'utf-8');
let lineNum = 1;
const stack = [];

for (let i = 0; i < content.length; i++) {
  if (content[i] === '\n') lineNum++;
  
  if (content[i] === '<' && content[i+1] !== '/' && /[A-Za-z]/.test(content[i+1])) {
    let tag = '';
    let j = i + 1;
    while (/[A-Za-z0-9\-]/.test(content[j])) {
      tag += content[j];
      j++;
    }
    
    // Check if self closing
    let k = j;
    let isSelfClosing = false;
    while (content[k] !== '>' && k < content.length) {
      if (content[k] === '/' && content[k+1] === '>') isSelfClosing = true;
      k++;
    }
    
    if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'path', 'circle', 'line', 'rect', 'polyline', 'polygon'].includes(tag)) {
      stack.push({tag, line: lineNum});
    }
  } else if (content[i] === '<' && content[i+1] === '/') {
    let tag = '';
    let j = i + 2;
    while (/[A-Za-z0-9\-]/.test(content[j])) {
      tag += content[j];
      j++;
    }
    
    const last = stack.pop();
    if (last && last.tag !== tag) {
      console.log(`Mismatch at line ${lineNum}: found </${tag}> but expected </${last.tag}> (opened at ${last.line})`);
      break;
    }
  }
}
console.log('done checking');
