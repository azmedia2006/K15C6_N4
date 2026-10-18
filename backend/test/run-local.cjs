const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tms-suite-'));const results=[];
try{for(const file of fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')&&f!=='supabase.test.js').sort()){
 const env={...process.env,NODE_ENV:'test',TMS_OFFLINE:'true',SMTP_ENABLED:'false',TMS_DATA_FILE:path.join(folder,file+'.db.json'),SCHEDULE_DATA_FILE:path.join(folder,file+'.schedule.json')};
 const args=['node','--test',path.join(__dirname,file)];const r=spawnSync(process.execPath,args.slice(1),{env,encoding:'utf8',timeout:90000});
 console.log('\n### '+file+' ['+(r.status===0?'PASS':'FAIL')+']\n'+r.stdout+(r.stderr||''));results.push({file,exit:r.status});}
 console.log('LOCAL SUITE RESULTS '+JSON.stringify(results));process.exitCode=results.some(r=>r.exit!==0)?1:0;
}finally{fs.rmSync(folder,{recursive:true,force:true})}
