'use strict';
const fs=require('fs'),path=require('path');
const file=process.env.TMS_DATA_FILE || (process.env.SCHEDULE_DATA_FILE ? path.join(path.dirname(process.env.SCHEDULE_DATA_FILE),'tms-'+path.basename(process.env.SCHEDULE_DATA_FILE)) : path.join(__dirname,'data','tms.json'));
let saved={};if(fs.existsSync(file)){saved=JSON.parse(fs.readFileSync(file,'utf8'));if(!saved||typeof saved!=='object')throw Error('Kho dữ liệu không hợp lệ. Hãy khôi phục bản sao lưu.');}
const registered=new Map();let committing=false;
function register(name,get,set){if(Object.hasOwn(saved,name))set(JSON.parse(JSON.stringify(saved[name])));registered.set(name,{get,set});}
function snapshot(){const all={...saved};for(const [name,hooks]of registered)all[name]=hooks.get();return JSON.parse(JSON.stringify(all));}
function restore(value){const copy=JSON.parse(JSON.stringify(value));for(const [name,h]of registered)if(Object.hasOwn(copy,name))h.set(copy[name]);}
function commit(){if(committing)return;committing=true;try{const state=snapshot();fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(tmp,file);}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e;}saved=state;}finally{committing=false;}}
function middleware(req,res,next){const send=res.json.bind(res);res.json=value=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){try{commit();}catch(e){restore(saved);res.status(503);return send({success:false,message:'Không thể ghi dữ liệu. Thao tác chưa được lưu, hãy thử lại.'});}}return send(value)};next();}
module.exports={register,commit,snapshot,restore,middleware,file,hasPersisted:name=>Object.hasOwn(saved,name)};

module.exports.acquireLock=()=>{
 const lock=file+'.lock';fs.mkdirSync(path.dirname(file),{recursive:true});
 if(fs.existsSync(lock)){let pid;try{pid=Number(fs.readFileSync(lock,'utf8'));process.kill(pid,0);throw new Error('Kho dữ liệu đang được một tiến trình TMS khác sử dụng.');}catch(e){if(e.code==='ESRCH')fs.unlinkSync(lock);else throw e;}}
 const handle=fs.openSync(lock,'wx',0o600);fs.writeFileSync(handle,String(process.pid));fs.closeSync(handle);
 const cleanup=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock)}catch{}};
 process.on('exit',cleanup);process.on('SIGTERM',()=>process.exit(0));process.on('SIGINT',()=>process.exit(0));
};
