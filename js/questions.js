/* Trivia question generator. Categories are rows in QUESTION_TYPES; the picker chooses a
   category by weight, then single vs multi-select inside it. */

let questionBag=[],questionHistory=[],lastCategories=[],triviaSinceMulti=0;
function resetQuestions(){questionBag=[];questionHistory=[];lastCategories=[];triviaSinceMulti=0}

/* Band labels are language-pack keys (band.<label>). */
function populationBands(){return[{label:'under1m',min:0,max:1e6},{label:'1to5m',min:1e6,max:5e6},{label:'5to15m',min:5e6,max:15e6},{label:'15to50m',min:15e6,max:50e6},{label:'50to100m',min:50e6,max:100e6},{label:'over100m',min:100e6,max:Infinity}]}
/* Bundled populations are rounded estimates, so a country within 6% of a band edge could land on either
   side. Those countries are left out of population questions rather than risk a wrong "correct" answer. */
function nearPopulationEdge(p){return[1e6,5e6,15e6,50e6,100e6].some(e=>Math.abs(p-e)/e<.06)}
/* Each trivia category is one row: how to list its groups, who matches a group, and the wording.
   To add a category, add a row here. */
const QUESTION_TYPES=[
  {category:'language',groups:cp=>[...new Set(cp.flatMap(c=>c.languages||[]))],match:(c,g)=>(c.languages||[]).includes(g),
   single:(ct,g)=>t('q.languageSingle',{continent:continentName(ct),group:languageName(g)}),multi:(ct,g,n)=>t('q.languageMulti',{count:n,continent:continentName(ct),group:languageName(g)})},
  {category:'population',groups:()=>populationBands().map(b=>b.label),match:(c,g)=>{let b=populationBands().find(x=>x.label===g);return c.population>0&&!nearPopulationEdge(c.population)&&c.population>=b.min&&c.population<b.max},
   single:(ct,g)=>t('q.populationSingle',{continent:continentName(ct),group:t(`band.${g}`)}),multi:(ct,g,n)=>t('q.populationMulti',{count:n,continent:continentName(ct),group:t(`band.${g}`)})}
];
let _cq=null,_cqKey='';
function candidateQuestions(){
  let pool=triviaPool(),key=`${currentLang}|${expertise}|${pool.length}|${pool.filter(c=>c.population).length}|${pool.filter(c=>c.languages?.length).length}|${pool.filter(c=>c.continent).length}`;
  if(_cq&&_cqKey===key)return _cq;
  let out=[];
  pool.filter(c=>c.capital).forEach(c=>out.push({category:'capital',multi:false,required:1,eligible:[c.code],text:t('q.capital',{capital:capitalName(c)}),signature:`capital:${c.code}`}));
  let enriched=pool.filter(c=>c.continent),continents=[...new Set(enriched.map(c=>c.continent))];
  for(let continent of continents){let cp=enriched.filter(c=>c.continent===continent);
    for(let t of QUESTION_TYPES)for(let g of t.groups(cp)){
      let eligible=cp.filter(c=>t.match(c,g)).map(c=>c.code);
      if(eligible.length===1)out.push({category:t.category,multi:false,required:1,eligible,text:t.single(continent,g),signature:`${t.category}:single:${continent}:${g}`});
      else if(eligible.length>=2)out.push({category:t.category,multi:true,eligible,text:null,continent,group:g,type:t,signature:`${t.category}:multi:${continent}:${g}`});
    }}
  _cq=out;_cqKey=key;return out}
/* Multi-select specs are templates; the required count is rolled when the question is actually asked. */
function resolveQuestion(q){if(q.text)return q;let n=Math.min(5,q.eligible.length,2+Math.floor(Math.random()*Math.min(4,q.eligible.length-1)));return{category:q.category,multi:true,required:n,eligible:q.eligible,text:q.type.multi(q.continent,q.group,n),signature:q.signature}}
function takeQuestion(predicate){let matches=questionBag.map((q,i)=>predicate(q)?i:-1).filter(i=>i>=0);if(!matches.length)return null;let index=matches[Math.floor(Math.random()*matches.length)];return questionBag.splice(index,1)[0]}
/* Category is chosen first by weight, then single vs multi inside it, so the mix no longer depends on how big each pool happens to be. */
const CATEGORY_WEIGHTS={capital:.4,language:.3,population:.3};
function finishQuestion(q){q=resolveQuestion(q);triviaSinceMulti=q.multi?0:triviaSinceMulti+1;questionHistory.push(q.signature);questionHistory=questionHistory.slice(-20);lastCategories.push(q.category);lastCategories=lastCategories.slice(-3);return q}
/* Top up any category whose questions ran out, so no category is starved while another drains. */
function topUpBag(){let all=candidateQuestions(),recent=questionHistory.slice(-15),added=false;
  for(let cat of new Set(all.map(q=>q.category))){if(questionBag.some(q=>q.category===cat))continue;
    let mine=all.filter(q=>q.category===cat),fresh=mine.filter(q=>!recent.includes(q.signature));questionBag.push(...(fresh.length?fresh:mine));added=true}
  if(added)shuffle(questionBag)}
function nextTriviaQuestion(){
  topUpBag();
  let present=[...new Set(questionBag.map(q=>q.category))],last=lastCategories.slice(-2),usable=present.filter(c=>!(last.length===2&&last.every(x=>x===c)));
  if(!usable.length)usable=present;
  if(usable.length){
    let w=c=>CATEGORY_WEIGHTS[c]||.2,r=Math.random()*usable.reduce((a,c)=>a+w(c),0),cat=usable[0];
    for(let c of usable){r-=w(c);if(r<=0){cat=c;break}}
    let hasMulti=questionBag.some(q=>q.category===cat&&q.multi),wantMulti=hasMulti&&(triviaSinceMulti>=2||Math.random()<.4);
    let q=takeQuestion(x=>x.category===cat&&x.multi===wantMulti)||takeQuestion(x=>x.category===cat);
    if(q)return finishQuestion(q);
  }
  let options=shuffle(triviaPool().filter(x=>x.capital&&!questionHistory.includes(`capital:${x.code}`)));if(!options.length)options=shuffle(triviaPool().filter(x=>x.capital));
  let c=options[0];if(!c)throw new Error('No valid trivia questions are available.');
  return finishQuestion({category:'capital',multi:false,required:1,eligible:[c.code],text:t('q.capital',{capital:capitalName(c)}),signature:`capital:${c.code}`})
}
