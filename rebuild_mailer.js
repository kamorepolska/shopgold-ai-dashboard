// rebuild_mailer.js — compile original source with all fixes applied pre-compilation
const fs = require('fs');
const babel = require('@babel/core');

// Load original JSX source (before any compilation)
const srcHtml = fs.readFileSync('MAILER.html', 'utf8');
const startTag = '<script type="text/babel" data-presets="react">';
const endTag = '</script>';
const start = srcHtml.indexOf(startTag);
const end = srcHtml.lastIndexOf(endTag);
let jsx = srcHtml.slice(srcHtml.indexOf('>', start) + 1, end);

// Inject SVG chart components before Dashboard (replace Recharts usage)
const svgCharts = `
// ============================================================
// SVG CHARTS (replaces Recharts)
// ============================================================
const SimpleAreaChart = ({data}) => {
  const W=560, H=180, pl=40, pr=10, pt=10, pb=30;
  const cW=W-pl-pr, cH=H-pt-pb;
  const maxV=Math.max(...data.map(d=>d.sent))||1;
  const x=i=>pl+i*(cW/(data.length-1));
  const y=v=>pt+cH-(v/maxV)*cH;
  const line=key=>data.map((d,i)=>x(i)+','+y(d[key])).join(' ');
  const area=key=>{const pts=data.map((d,i)=>x(i)+','+y(d[key])).join(' ');return pts+' '+x(data.length-1)+','+(pt+cH)+' '+x(0)+','+(pt+cH);};
  const labels = [{k:'sent',c:'#185FA5',n:'Wysłano'},{k:'opened',c:'#16a34a',n:'Otwarto'},{k:'clicked',c:'#f59e0b',n:'Kliknięto'}];
  return <svg viewBox={"0 0 "+W+" "+H} style={{width:'100%',height:H+'px'}}>
    <defs>
      {labels.slice(0,2).map(({k,c})=><linearGradient key={k} id={"g"+k} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={c} stopOpacity="0.2"/><stop offset="95%" stopColor={c} stopOpacity="0"/>
      </linearGradient>)}
    </defs>
    {[0.25,0.5,0.75,1].map((p,i)=><line key={i} x1={pl} x2={W-pr} y1={y(maxV*p)} y2={y(maxV*p)} stroke="#f0f0f0" strokeWidth="1"/>)}
    {labels.slice(0,2).map(({k})=><polygon key={k} points={area(k)} fill={"url(#g"+k+")"} opacity="0.6"/>)}
    {labels.map(({k,c},i)=><polyline key={k} points={line(k)} fill="none" stroke={c} strokeWidth="2" strokeDasharray={i===2?"4 4":undefined}/>)}
    {data.map((d,i)=><text key={i} x={x(i)} y={H-8} textAnchor="middle" fontSize="11" fill="#94a3b8">{d.day}</text>)}
    {labels.map(({c,n},i)=><g key={i} transform={"translate("+(W-190+i*65)+",6)"}>
      <circle r="4" cx="4" cy="4" fill={c}/><text x="11" y="8" fontSize="10" fill="#64748b">{n}</text>
    </g>)}
  </svg>;
};

const SimpleBarChart = ({data}) => {
  const W=640, H=130, pl=30, pr=10, pt=10, pb=25;
  const cW=W-pl-pr, cH=H-pt-pb;
  const maxV=Math.max(...data.map(d=>d.opens))||1;
  const gap=cW/data.length;
  const bW=Math.max(4,gap*0.7);
  return <svg viewBox={"0 0 "+W+" "+H} style={{width:'100%',height:H+'px'}}>
    {[0.25,0.5,0.75,1].map((p,i)=><line key={i} x1={pl} x2={W-pr} y1={pt+cH-p*cH} y2={pt+cH-p*cH} stroke="#f0f0f0"/>)}
    {data.map((d,i)=>{const bH=Math.max(2,(d.opens/maxV)*cH); const bX=pl+i*gap+(gap-bW)/2; return <g key={i}>
      <rect x={bX} y={pt+cH-bH} width={bW} height={bH} fill="#185FA5" rx="3" opacity="0.85"/>
      <text x={bX+bW/2} y={H-7} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.hour}</text>
    </g>;})}
  </svg>;
};

`;

// Replace Recharts dashboard block
const oldDashChart = `      <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={WEEK_DATA} margin={{top:0,right:0,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#185FA5" stopOpacity={0.15}/><stop offset="95%" stopColor="#185FA5" stopOpacity={0}/></linearGradient>
                <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="day" tick={{fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:12}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{borderRadius:'10px',border:'none',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}/>
              <Area type="monotone" dataKey="sent" stroke="#185FA5" fill="url(#gSent)" name="Wysłano" strokeWidth={2}/>
              <Area type="monotone" dataKey="opened" stroke="#16a34a" fill="url(#gOpen)" name="Otwarto" strokeWidth={2}/>
              <Area type="monotone" dataKey="clicked" stroke="#f59e0b" fill="none" name="Kliknięto" strokeWidth={2} strokeDasharray="4 4"/>
              <Legend iconType="circle" iconSize={8}/>
            </AreaChart>
          </ResponsiveContainer>`;

jsx = jsx.replace(oldDashChart, '          <SimpleAreaChart data={WEEK_DATA}/>');

const oldOpensChart = `<ResponsiveContainer width="100%" height={160}>
          <BarChart data={HOUR_DATA.filter((_,i)=>i%2===0)} margin={{top:0,right:0,bottom:0,left:-20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="hour" tick={{fontSize:11}} axisLine={false} tickLine={false} interval={1}/>
            <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:'10px',border:'none',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}/>
            <Bar dataKey="opens" fill="#185FA5" radius={[4,4,0,0]} name="Odczyty"/>
          </BarChart>
        </ResponsiveContainer>`;

jsx = jsx.replace(oldOpensChart, '        <SimpleBarChart data={HOUR_DATA.filter((_,i)=>i%2===0)}/>');

// Remove Recharts import line
jsx = jsx.replace(/const \{.*?FunnelChart.*?Recharts;\n/s, '// No Recharts - using inline SVG\n');

// Insert SVG charts before Dashboard
jsx = jsx.replace('// ============================================================\n// DASHBOARD', svgCharts + '// ============================================================\n// DASHBOARD');

console.log('JSX prepared:', jsx.length, 'bytes');
console.log('Has SimpleAreaChart:', jsx.includes('SimpleAreaChart'));
console.log('Has Recharts refs remaining:', jsx.includes('AreaChart data') || jsx.includes('BarChart data'));

// Compile
const result = babel.transformSync(jsx, {
  presets: [['@babel/preset-react', {runtime:'classic'}]],
  compact: false
});

console.log('Compiled JS:', result.code.length, 'bytes');

// Verify syntax
try { new Function(result.code); console.log('SYNTAX OK!'); }
catch(e) { console.log('SYNTAX ERR:', e.message); process.exit(1); }

// Build final HTML
const before = srcHtml.slice(0, start)
  .replace('<script src="https://unpkg.com/recharts@2.12.7/umd/Recharts.js"></script>', '')
  .replace(/<script src="https:\/\/unpkg\.com\/@babel[^"]*"><\/script>/, '');
const after = srcHtml.slice(end + endTag.length);

const finalHtml = before + '<script>\n' + result.code + '\n</script>' + after;
fs.writeFileSync('frontend/MAILER.html', finalHtml, 'utf8');
console.log('Written! Size:', finalHtml.length);
