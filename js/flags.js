/* Flags: Study Mode helpers, and loading flag images with fallbacks across several sources. */

const preloaded=new Set();

function flagReadMoreUrl(country){
  let article=FLAG_ARTICLE_NAMES[country.code]||country.name;
  if(country.independent===false||['AX','BQ','BV','CC','CX','EH','GF','GP','GS','HM','IO','MF','MQ','NC','NF','PF','PM','RE','SJ','TF','UM','WF','YT'].includes(country.code)){
    return`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`Flag of ${article}`)}`;
  }
  return`https://en.wikipedia.org/wiki/Flag_of_${encodeURIComponent(article.replaceAll(' ','_'))}`;
}
function flagStudyEntry(country){
  let exact=FLAG_STUDY_DATA[country.code],extra=FLAG_STUDY_EXTRA[country.code];
  return{
    summary:exact?.summary||extra||`The flag of ${country.name} is rooted in the country or territory’s political and heraldic history. No single concise official symbolism is consistently documented, so Study Mode avoids assigning disputed meanings.`,
    source:flagReadMoreUrl(country)
  };
}

const FLAG_PREF_KEY='geographyFlagSourcePreferencesV1';
const FLAG_SOURCE_BUILDERS=[
  code=>`https://flags.restcountries.com/v5/w640/${code}.png`,
  code=>`https://flagcdn.com/${code}.svg`,
  code=>`https://flagcdn.io/${code}.svg`,
  code=>`https://flagcdn.com/w640/${code}.png`
];
function flagPreferences(){try{return JSON.parse(LS.getItem(FLAG_PREF_KEY)||'{}')}catch{return{}}}
function rememberFlagSource(code,index){let prefs=flagPreferences();prefs[code]=index;try{LS.setItem(FLAG_PREF_KEY,JSON.stringify(prefs))}catch{}}
function flagEmoji(code){return code.toUpperCase().replace(/[A-Z]/g,c=>String.fromCodePoint(127397+c.charCodeAt()))}
function emojiFlagData(code){let emoji=flagEmoji(code),svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" rx="24" fill="#f8fafc"/><text x="320" y="255" text-anchor="middle" font-size="190">${emoji}</text></svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
function flagSources(code){code=code.toLowerCase();let preferred=flagPreferences()[code],order=FLAG_SOURCE_BUILDERS.map((_,i)=>i);if(Number.isInteger(preferred)&&order.includes(preferred))order=[preferred,...order.filter(i=>i!==preferred)];return order.map(index=>({index,url:FLAG_SOURCE_BUILDERS[index](code)}))}
function loadFlag(img,countryCode,{alt='',timeout=3500}={}){return new Promise(resolve=>{let code=countryCode.toLowerCase(),sources=flagSources(code),attempt=0,timer=0,finished=false;img.classList.add('loading');img.alt=alt||`${countryCode.toUpperCase()} flag`;const done=(ok,source='emoji')=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=null;img.onerror=null;img.classList.remove('loading');resolve({ok,source})};const next=()=>{clearTimeout(timer);if(attempt>=sources.length){img.src=emojiFlagData(code);setTimeout(()=>done(false,'emoji'),0);return}let current=sources[attempt++];img.onload=()=>{rememberFlagSource(code,current.index);done(true,current.url)};img.onerror=next;timer=setTimeout(next,timeout);img.src=current.url};next()})}
function preloadFlags(){let queue=flagPool().map(c=>c.code).filter(c=>!preloaded.has(c)),active=0,max=4;const run=()=>{while(active<max&&queue.length){active++;let code=queue.shift();preloaded.add(code);let img=new Image();loadFlag(img,code,{timeout:2200}).finally(()=>{active--;setTimeout(run,60)})}};setTimeout(run,500)}
