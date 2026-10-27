/** Biography records stay in memory on the user's machine, not in the front-end bundle. */
export function modulePeople(document, moduleTitle, query, sceneText='') {
  const start=document.outline.find(entry=>entry.title==='Appendix C: Biographies')?.page;
  if(!start) return [];
  const pages=document.pages.slice(start-1,194).map(text=>text.split('©')[0]);
  const offsets=[];let offset=0;
  for(const page of pages){offsets.push(offset);offset+=page.length+1;}
  const text=pages.join('\n');
  const headings=[...text.matchAll(/^([^\n]{1,65}（(?:他|她|他们|她们|它)）)\s*[：:]/gm)];
  const compact=value=>value.replace(/\s+/g,'');
  const context=compact(query+' '+sceneText);
  return headings.map((heading,index)=>{
    const raw=compact(text.slice(heading.index,headings[index+1]?.index??text.length));
    const appearance=/登场于[^。]+。/.exec(raw);
    const body=appearance?raw.slice(0,appearance.index+appearance[0].length):raw;
    const name=compact(heading[1]).replace(/（[^）]+）$/,'');
    const page=start+offsets.filter(value=>value<=heading.index).length-1;
    const terms=[name,name.replace(/[“”‘’]/g,'').split('·')[0]].filter(term=>term.length>=2);
    return {sourceId:document.id,title:document.title,name,page,text:body.slice(0,750),kind:'npc',gmOnly:true,score:terms.some(term=>compact(query).includes(term))?20:terms.some(term=>context.includes(term))?5:0,moduleMatch:body.includes(`《${compact(moduleTitle)}》`)};
  }).filter(entry=>entry.moduleMatch && entry.score>0).sort((a,b)=>b.score-a.score).slice(0,2).map(({moduleMatch,...entry})=>entry);
}
