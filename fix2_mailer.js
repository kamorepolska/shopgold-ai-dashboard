// fix2_mailer.js — fix compiled JS references to Recharts components
const fs = require('fs');
let h = fs.readFileSync('frontend/MAILER.html', 'utf8');

// The compiled JS uses React.createElement(AreaChart, {...}) 
// We need to replace the entire Dashboard chart section and EmailOpens chart section

// Find and replace the compiled AreaChart block in Dashboard
// It looks like: React.createElement(ResponsiveContainer, {...}, React.createElement(AreaChart, {...}, ...))

// Strategy: replace specific compiled createElement calls by regex
// Since the code is compiled, we look for patterns

// Replace ResponsiveContainer+AreaChart block in Dashboard
const rcAreaPattern = /\/\*#__PURE__\*\/React\.createElement\(ResponsiveContainer[^;]+AreaChart[^;]+;/s;
const rcAreaMatch = h.match(rcAreaPattern);
if (rcAreaMatch) {
  console.log('Found AreaChart block, length:', rcAreaMatch[0].length);
  h = h.replace(rcAreaPattern, '/*#__PURE__*/React.createElement(SimpleAreaChart, {data: WEEK_DATA}),');
} else {
  console.log('AreaChart pattern NOT found - trying alternative');
  // Find the line with AreaChart
  const lines = h.split('\n');
  const idx = lines.findIndex(l => l.includes('React.createElement(AreaChart'));
  if (idx >= 0) {
    console.log('Found AreaChart at line:', idx+1, ':', lines[idx].slice(0,100));
  }
}

// Replace ResponsiveContainer+BarChart block in EmailOpens
const rcBarPattern = /\/\*#__PURE__\*\/React\.createElement\(ResponsiveContainer[^;]+BarChart[^;]+;/s;
const rcBarMatch = h.match(rcBarPattern);
if (rcBarMatch) {
  console.log('Found BarChart block, length:', rcBarMatch[0].length);
  h = h.replace(rcBarPattern, '/*#__PURE__*/React.createElement(SimpleBarChart, {data: HOUR_DATA.filter(function(_,i){return i%2===0})}),');
} else {
  console.log('BarChart pattern NOT found');
}

fs.writeFileSync('frontend/MAILER.html', h, 'utf8');
const remaining = (h.match(/React\.createElement\((AreaChart|BarChart|ResponsiveContainer|LineChart)/g) || []);
console.log('Remaining Recharts createElement calls:', remaining.length, remaining.slice(0,5));
