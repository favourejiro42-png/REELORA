import crypto from 'node:crypto';

function b64(value){return Buffer.from(value).toString('base64url');}
async function accessToken(sa){
  const now=Math.floor(Date.now()/1000);
  const header=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=b64(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${header}.${claim}`;
  const signer=crypto.createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${signer.sign(sa.private_key,'base64url')}`;
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const d=await r.json();if(!r.ok)throw new Error(d.error_description||'Google service-account authentication failed.');return d.access_token;
}
async function fsGet(url,token){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Firestore request failed.');return d;}
function val(v){if(!v)return null;return v.stringValue??v.integerValue??v.booleanValue??v.timestampValue??null;}
function fields(doc){const o={};for(const [k,v] of Object.entries(doc.fields||{}))o[k]=val(v);return o;}
async function sendOneSignal(appId,key,uid,title,message,url){
  const r=await fetch('https://api.onesignal.com/notifications',{method:'POST',headers:{Authorization:`Key ${key}`,'Content-Type':'application/json'},body:JSON.stringify({app_id:appId,include_aliases:{external_id:[uid]},target_channel:'push',headings:{en:title},contents:{en:message},url})});
  const d=await r.json();if(!r.ok)throw new Error(d.errors?.[0]||'OneSignal send failed.');return d;
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
  try{
    const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
    const appId=process.env.ONESIGNAL_APP_ID,key=process.env.ONESIGNAL_REST_API_KEY;
    if(!sa.client_email||!sa.private_key||!sa.project_id||!appId||!key)return res.status(503).json({error:'Release alerts need FIREBASE_SERVICE_ACCOUNT_JSON, ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY.'});
    const token=await accessToken(sa),base=`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const tomorrow=new Date();tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const target=tomorrow.toISOString().slice(0,10);
    const users=await fsGet(`${base}/users?pageSize=300`,token);let checked=0,sent=0,skipped=0;
    for(const user of users.documents||[]){
      const uid=user.name.split('/').pop();
      const pref=await fsGet(`${base}/users/${uid}/settings/notifications`,token).catch(()=>null);
      if(val(pref?.fields?.releaseAlerts)!==true){skipped++;continue;}
      const list=await fsGet(`${base}/users/${uid}/watchlist?pageSize=100`,token).catch(()=>({documents:[]}));
      for(const item of list.documents||[]){
        checked++;const x=fields(item),type=x.media_type;let date=x.release_date||null,episode=false;
        if(type==='tv'&&x.tmdbId&&process.env.TMDB_API_KEY){
          const tr=await fetch(`https://api.themoviedb.org/3/tv/${encodeURIComponent(x.tmdbId)}`,{headers:{Authorization:`Bearer ${process.env.TMDB_API_KEY}`,Accept:'application/json'}});
          if(tr.ok){const td=await tr.json();date=td.next_episode_to_air?.air_date||null;episode=!!td.next_episode_to_air;}
        }
        if(date!==target||x.lastAlertDate===target)continue;
        const title=episode?`${x.title}: new episode tomorrow`:`${x.title} premieres tomorrow`;
        const body=episode?`A new episode is scheduled for ${target}.`:`${x.title} is scheduled for release on ${target}.`;
        await sendOneSignal(appId,key,uid,title,body,'https://reelora-gray.vercel.app/');
        const docName=item.name;
        await fetch(`${'https://firestore.googleapis.com/v1/'}${docName}?updateMask.fieldPaths=lastAlertDate`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{lastAlertDate:{stringValue:target}}})});
        sent++;
      }
    }
    return res.status(200).json({ok:true,date:target,users:(users.documents||[]).length,checked,sent,skipped});
  }catch(e){console.error('Release alert cron failed:',e);return res.status(500).json({error:e.message||'Release alert job failed.'});}
}
