import {execFileSync} from "node:child_process";
const marker="LivingRuntime diagnostic submission "+new Date().toISOString();
const form=new FormData();form.set("content",marker);form.set("email","");form.set("pageUrl","/feedback");
const response=await fetch("http://127.0.0.1:3000/api/site/feedback",{method:"POST",body:form,signal:AbortSignal.timeout(17000)});
const body=await response.json().catch(()=>({}));
console.log(JSON.stringify({status:response.status,responseId:Number.isInteger(body.id)?body.id:null}));
if(response.status!==201||!Number.isInteger(body.id)||body.id<1)process.exit(1);
function sqlQuery(query){
 const args=["exec","-i","aihot-db-1","sh","-c",'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'];
 return execFileSync("docker",args,{input:query,encoding:"utf8",timeout:17000,stdio:["pipe","pipe","pipe"]}).trim();
}
const id=body.id;
const n=sqlQuery("SELECT count(*) FROM feedback WHERE id="+id+" AND content LIKE 'LivingRuntime diagnostic submission %';");
console.log(JSON.stringify({foundInDatabase:n==="1"}));
if(n!=="1")process.exitCode=1;
const cleaned=sqlQuery("DELETE FROM feedback WHERE id="+id+" AND content LIKE 'LivingRuntime diagnostic submission %' RETURNING id;");
const cleanedOk=cleaned.split(/\s+/).includes(String(id));
console.log(JSON.stringify({diagnosticRowCleaned:cleanedOk}));
if(!cleanedOk)process.exitCode=1;
