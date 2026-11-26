import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const CREATOR_EMAIL = 'artdark962@gmail.com';
function adminServices(){
  if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  const serviceAccount=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app=getApps()[0]||initializeApp({credential:cert(serviceAccount),projectId:serviceAccount.project_id});
  return {auth:getAuth(app),db:getFirestore(app)};
}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
async function verifiedUser(auth,req){const token=bearer(req);if(!token)return null;try{return await auth.verifyIdToken(token);}catch{return null;}}
export default async function handler(req,res){
  try{
    const {auth,db}=adminServices();
    if(req.method==='POST'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const visitorId=String(body.visitorId||'').slice(0,80);
      const page=String(body.page||'/').slice(0,120);
      if(!/^[a-zA-Z0-9_-]{12,80}$/.test(visitorId))return res.status(400).json({error:'Invalid visitor session.'});
      const user=await verifiedUser(auth,req);
      const day=new Date().toISOString().slice(0,10);
      const visitRef=db.collection('siteVisits').doc(`${day}_${visitorId}`);
      const data={visitorId,page,lastSeen:FieldValue.serverTimestamp(),pageViews:FieldValue.increment(1),day};
      if(user){data.uid=user.uid;data.email=user.email||null;data.displayName=user.name||null;}
      await visitRef.set({...data,firstSeen:FieldValue.serverTimestamp()},{merge:true});
      if(user){
        await db.collection('publicUserProfiles').doc(user.uid).set({uid:user.uid,email:user.email||null,displayName:user.name||null,lastSeen:FieldValue.serverTimestamp(),lastLoginAt:user.auth_time?new Date(user.auth_time*1000):null,provider:user.firebase?.sign_in_provider||'unknown'},{merge:true});
      }
      return res.status(200).json({ok:true});
    }
    if(req.method==='GET'){
      const user=await verifiedUser(auth,req);
      if(!user||user.email_verified!==true||String(user.email||'').toLowerCase()!==CREATOR_EMAIL)return res.status(403).json({error:'Creator access only. Sign in with the verified creator email.'});
      const [usersResult,visitsResult]=await Promise.all([
        auth.listUsers(1000),
        db.collection('siteVisits').orderBy('lastSeen','desc').limit(300).get()
      ]);
      const users=usersResult.users.map(u=>({uid:u.uid,email:u.email||'',displayName:u.displayName||'',createdAt:u.metadata.creationTime||null,lastSignInAt:u.metadata.lastSignInTime||null,disabled:!!u.disabled,provider:u.providerData.map(p=>p.providerId).join(', ')||'password'}));
      const visits=visitsResult.docs.map(d=>{const x=d.data();return {visitorId:x.visitorId||'',page:x.page||'/',day:x.day||'',pageViews:Number(x.pageViews||1),firstSeen:x.firstSeen?.toDate?.()?.toISOString()||null,lastSeen:x.lastSeen?.toDate?.()?.toISOString()||null,email:x.email||'',displayName:x.displayName||'',uid:x.uid||''};});
      return res.status(200).json({ok:true,users,visits,generatedAt:new Date().toISOString()});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(error){console.error('Creator dashboard API:',error);return res.status(500).json({error:'Creator dashboard is unavailable. Check the Firebase service-account configuration.'});}
}
