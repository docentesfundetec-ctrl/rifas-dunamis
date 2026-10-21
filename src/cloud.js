import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithRedirect,getRedirectResult,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInAnonymously,signOut,setPersistence,inMemoryPersistence,deleteUser,sendPasswordResetEmail} from 'firebase/auth';
import {getFirestore,doc,collection,getDoc,getDocs,onSnapshot,query,where,runTransaction,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
import {firebaseConfig} from './firebase-config.js';
import {freshState,phoneDigits,validateBuyer,secureIndex} from './core.js';
export const ADMIN_EMAIL='docentesfundetec@gmail.com';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const ref=(c,id)=>doc(db,c,String(id));
const raffleRef=ref('raffles','current');
export const session={user:null,role:'guest',profile:null,ready:false};
export const data={settings:null,tickets:{},sales:{},sellers:[],winner:null,phase:'open',link:null,loaded:false,error:''};
let notify=()=>{},publicTickets={},privateSales={},privateUnsubs=[],generation=0;
function merged(){data.tickets=Object.fromEntries(Object.entries(publicTickets).map(([id,t])=>[id,{...t,...privateSales[id]}]));data.sales=privateSales;notify();}
function watchError(e){data.error=message(e);notify();}
function watchPrivate(q,cb){privateUnsubs.push(onSnapshot(q,cb,watchError));}
export function start(cb,linkId){notify=cb;
 getRedirectResult(auth).then(async result=>{if(result&&result.user.email!==ADMIN_EMAIL){await signOut(auth);throw Error('La administración está reservada para '+ADMIN_EMAIL+'.');}}).catch(watchError);
 if(location.hostname===firebaseConfig.authDomain&&new URL(location.href).searchParams.get('login')==='google'){
  const url=new URL(location.href);url.searchParams.delete('login');history.replaceState(null,'',url);
  auth.authStateReady().then(()=>{if(auth.currentUser?.email!==ADMIN_EMAIL)return loginGoogle();}).catch(watchError);
 }

 onSnapshot(raffleRef,snap=>{data.loaded=true;if(snap.exists()){const r=snap.data();data.settings={...r,drawAt:r.drawAt.toDate().toISOString()};data.phase=r.phase;data.winner=r.winner?{...r.winner,drawnAt:r.winner.drawnAt.toDate().toISOString(),eligible:Array(r.winner.participants).fill(0)}:null;}else {data.settings=null;data.winner=null;data.phase="open";}notify();},watchError);
 onSnapshot(collection(db,'tickets'),snap=>{publicTickets=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));merged();},watchError);
 if(linkId)onSnapshot(ref('sellerLinks',linkId),snap=>{data.link=snap.exists()?{id:snap.id,...snap.data()}:null;notify();},watchError);
 onAuthStateChanged(auth,async user=>{const epoch=++generation;privateUnsubs.forEach(u=>u());privateUnsubs=[];privateSales={};data.sellers=[];session.user=user;session.role='guest';session.profile=null;session.ready=false;merged();
  try{if(user&&!user.isAnonymous){const token=await user.getIdTokenResult();if(epoch!==generation)return;
   if(user.email===ADMIN_EMAIL&&user.emailVerified&&token.signInProvider==='google.com'){session.role='admin';session.profile={name:'Administración Dunamis'};
    watchPrivate(collection(db,'sellers'),snap=>{data.sellers=snap.docs.map(d=>({id:d.id,...d.data()}));notify();});
    watchPrivate(collection(db,'sales'),snap=>{privateSales=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));merged();});
   }else{const p=await getDoc(ref('sellers',user.uid));if(epoch!==generation)return;if(p.exists()&&p.data().active){session.role='seller';session.profile={id:user.uid,...p.data()};data.sellers=[session.profile];watchPrivate(query(collection(db,'sales'),where('sellerId','==',user.uid)),snap=>{privateSales=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));merged();});}else session.role='unassigned';}
  }else if(user){watchPrivate(query(collection(db,'sales'),where('buyerUid','==',user.uid)),snap=>{privateSales=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));merged();});}}
  catch(e){watchError(e);}finally{if(epoch===generation){session.ready=true;notify();}}
 });
}
export function message(e){return ({'auth/popup-closed-by-user':'Se cerró el inicio de sesión. Puedes intentarlo nuevamente.','auth/unauthorized-domain':'Este dominio debe habilitarse en Firebase Authentication.','auth/invalid-credential':'Revisa el correo y la contraseña.','auth/email-already-in-use':'Ese correo ya tiene una cuenta. Usa la opción de vincular una cuenta existente.','auth/weak-password':'La contraseña inicial debe tener al menos 6 caracteres.','auth/too-many-requests':'Se realizaron demasiados intentos. Espera unos minutos.','permission-denied':'No tienes permiso para esta operación o la rifa ya cerró. Actualiza y comprueba tu sesión.','unavailable':'No hay conexión con la base de datos. Inténtalo cuando vuelva la conexión.'})[e.code]||e.message||'No fue posible completar la operación.';}
export async function loginGoogle(){
 data.error='';
 if(location.hostname!==firebaseConfig.authDomain){location.assign('https://'+firebaseConfig.authDomain+'/?login=google#administracion');return;}
 const p=new GoogleAuthProvider();p.setCustomParameters({login_hint:ADMIN_EMAIL,prompt:'select_account'});
 try{await signInWithRedirect(auth,p);}catch(e){data.error=message(e)+(e.code?' ('+e.code+')':'');notify();throw e;}
}

export const loginSeller=(email,password)=>signInWithEmailAndPassword(auth,email.trim(),password);
export const logout=()=>signOut(auth);
export const resetPassword=email=>sendPasswordResetEmail(auth,email.trim());
export async function addSeller({name,email,password,existing=false}){
 if(session.role!=='admin')throw Error('Solo el administrador puede registrar vendedores.');
 name=name.trim();email=email.trim().toLowerCase();if(name.length<3)throw Error('Escribe el nombre completo del vendedor.');
 const secondary=initializeApp(firebaseConfig,'seller-'+crypto.randomUUID());const secondaryAuth=getAuth(secondary);await setPersistence(secondaryAuth,inMemoryPersistence);let created=null;
 try{const account=existing?await signInWithEmailAndPassword(secondaryAuth,email,password):await createUserWithEmailAndPassword(secondaryAuth,email,password);if(!existing)created=account.user;
 const sellerId=account.user.uid;const previous=await getDoc(ref('sellers',sellerId));if(previous.exists())throw Error('Este vendedor ya está registrado.');
 const batch=writeBatch(db);batch.set(ref('sellers',sellerId),{name,email,active:true,createdAt:serverTimestamp()});batch.set(ref('sellerLinks',sellerId),{name,active:true});await batch.commit();return sellerId;
 }catch(e){if(created)await deleteUser(created).catch(()=>{});throw e;}finally{await signOut(secondaryAuth).catch(()=>{});await deleteApp(secondary);}
}
export async function toggleSeller(s){if(session.role!=='admin')throw Error('Acceso exclusivo del administrador.');const batch=writeBatch(db);batch.update(ref('sellers',s.id),{active:!s.active});batch.update(ref('sellerLinks',s.id),{active:!s.active});await batch.commit();}
export async function saveSettings(settings){if(session.role!=='admin')throw Error('Acceso exclusivo del administrador.');
 await runTransaction(db,async tx=>{const snap=await tx.get(raffleRef);if(snap.exists()&&snap.data().phase!=='open')throw Error('La rifa ya está cerrada para cambios.');if(snap.exists()&&(settings.total!==snap.data().total||settings.price!==snap.data().price))throw Error('El precio y la cantidad se fijan al crear la rifa.');
 tx.set(raffleRef,{...settings,testMode:snap.exists()?!!snap.data().testMode:false,phase:'open',winner:null,drawAt:Timestamp.fromDate(new Date(settings.drawAt)),updatedAt:serverTimestamp()});});
}
export function defaults(){return freshState().settings;}
export async function createTestRaffle(){
 if(session.role!=='admin')throw Error('Acceso exclusivo del administrador.');
 await runTransaction(db,async tx=>{
  if((await tx.get(raffleRef)).exists())throw Error('Ya existe una rifa.');
  tx.set(raffleRef,{...defaults(),title:'Rifa de prueba Dunamis',prize:'Premio de demostración',description:'Demostración del sistema. No se reciben pagos ni se entrega un premio real.',price:1000,total:100,testMode:true,automatic:false,phase:'open',winner:null,drawAt:Timestamp.fromMillis(Date.now()+15*86400000),updatedAt:serverTimestamp()});
 });
 const batch=writeBatch(db);
 batch.set(ref('sellers','demo-seller'),{name:'Vendedor de prueba (sin acceso)',email:'prueba@example.invalid',active:true,createdAt:serverTimestamp()});
 batch.set(ref('sellerLinks','demo-seller'),{name:'Vendedor de prueba (sin acceso)',active:true});
 await batch.commit();
}
export async function removeTestRaffle(){
 if(session.role!=='admin'||!data.settings?.testMode)throw Error('Solo se puede limpiar una rifa de prueba.');
 await runTransaction(db,async tx=>{const snap=await tx.get(raffleRef);if(!snap.data()?.testMode)throw Error('Esta rifa no es de prueba.');tx.update(raffleRef,{phase:'resetting',updatedAt:serverTimestamp()});});
 const all=await getDocs(collection(db,'tickets'));
 for(let start=0;start<all.docs.length;start+=5){const batch=writeBatch(db);for(const ticket of all.docs.slice(start,start+5)){batch.delete(ticket.ref);batch.delete(ref('sales',ticket.id));}await batch.commit();}
 const batch=writeBatch(db);batch.delete(ref('sellers','demo-seller'));batch.delete(ref('sellerLinks','demo-seller'));await batch.commit();
 await runTransaction(db,async tx=>{await tx.get(raffleRef);tx.delete(raffleRef);});
}
export async function reserve({number,sellerId,name,phone}){
 validateBuyer(name,phone);if(!auth.currentUser)await signInAnonymously(auth);const uid=auth.currentUser.uid;
 await runTransaction(db,async tx=>{const [raffle,ticket,link]=await Promise.all([tx.get(raffleRef),tx.get(ref('tickets',number)),tx.get(ref('sellerLinks',sellerId))]);
 if(!raffle.exists()||raffle.data().phase!=='open'||Date.now()>=raffle.data().drawAt.toMillis())throw Error('Las reservas están cerradas.');
 if(ticket.exists())throw Error('Otra persona acaba de elegir este número. Selecciona otro disponible.');if(!link.exists()||!link.data().active)throw Error('Este enlace de vendedor ya no está activo.');
 const ticketData={number,status:'reserved',sellerId,updatedAt:serverTimestamp()};tx.set(ref('tickets',number),ticketData);tx.set(ref('sales',number),{...ticketData,buyerUid:uid,name:name.trim(),phone:phoneDigits(phone),createdAt:serverTimestamp()});});
}
export async function changeSale(number,{status,name,phone}){validateBuyer(name,phone);await runTransaction(db,async tx=>{const [r,sale]=await Promise.all([tx.get(raffleRef),tx.get(ref('sales',number))]);if(!sale.exists())throw Error('Esta reserva ya no existe.');if(r.data().phase!=='open'||Date.now()>=r.data().drawAt.toMillis())throw Error('La rifa ya cerró.');const original=sale.data();if(session.role!=='admin'&&original.sellerId!==session.user?.uid)throw Error('Solo puedes gestionar tus ventas.');tx.update(ref('sales',number),{status,name:name.trim(),phone:phoneDigits(phone),updatedAt:serverTimestamp()});tx.update(ref('tickets',number),{status,updatedAt:serverTimestamp()});});}
export async function release(number){await runTransaction(db,async tx=>{const sale=await tx.get(ref('sales',number));if(!sale.exists())throw Error('La reserva ya fue liberada.');tx.delete(ref('sales',number));tx.delete(ref('tickets',number));});}
export async function performDraw(){if(session.role!=='admin')throw Error('Solo el administrador puede realizar el sorteo.');const poolBefore=await getDocs(query(collection(db,'tickets'),where('status','==','paid')));if(poolBefore.empty)throw Error('Se requiere al menos un número pagado.');
 await runTransaction(db,async tx=>{const snap=await tx.get(raffleRef),r=snap.data();if(r.phase==='finished')throw Error('La rifa ya tiene ganador.');if(Date.now()<r.drawAt.toMillis())throw Error('Todavía no llega la fecha del sorteo.');if(r.phase==='open')tx.update(raffleRef,{phase:'drawing',updatedAt:serverTimestamp()});});
 const pool=(await getDocs(query(collection(db,'tickets'),where('status','==','paid')))).docs.map(d=>d.data().number).sort((a,b)=>a-b);
 if(!pool.length)throw Error('No hay números pagados.');const number=pool[secureIndex(pool.length)];
 await runTransaction(db,async tx=>{const r=(await tx.get(raffleRef)).data();if(r.phase==='finished')throw Error('El resultado ya fue guardado en otra sesión.');if(r.phase!=='drawing')throw Error('No se pudo bloquear la rifa para el sorteo.');tx.update(raffleRef,{phase:'finished',winner:{number,drawnAt:serverTimestamp(),participants:pool.length},updatedAt:serverTimestamp()});});return number;
}
