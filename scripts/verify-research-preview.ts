// Smoke check deployed public event pages without credentials or mutations.
const base=process.argv[2]||"http://127.0.0.1:3000";
const hotResponse=await fetch(base+"/api/site/hot",{signal:AbortSignal.timeout(8000)});
const hot=await hotResponse.json();
const event=hot.entries?.find(e=>/Gemini|Argon/i.test(e.story?.title??""))??hot.entries?.[0];
if(!event){console.log(JSON.stringify({status:"no_current_hot_event",hotStatus:hotResponse.status}));process.exit();}
const uuid=event.story.publicId;
const storyResponse=await fetch(base+"/api/site/stories/"+uuid,{signal:AbortSignal.timeout(8000)});
const story=await storyResponse.json();
const pageResponse=await fetch(base+"/story/"+uuid,{signal:AbortSignal.timeout(8000)});
const page=await pageResponse.text();
const reports=story.timeline??[];
console.log(JSON.stringify({
 hotStatus:hotResponse.status,storyStatus:storyResponse.status,pageStatus:pageResponse.status,
 title:story.title,reportCount:story.reportCount,sourceCount:story.sourceCount,
 official:reports.filter(x=>x.source?.firstParty).length,independent:reports.filter(x=>!x.source?.firstParty).length,
 sourceUrls:reports.filter(x=>(x.originalUrl??"").startsWith("https://")).length,
 evidencePanel:page.includes("证据与独立视角"),originalLink:page.includes("核对原始报道"),
 uuid
}));
