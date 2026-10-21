export const KEY='dunamis.raffle.v1';
export function freshState(now=Date.now()) {return {version:1,revision:0,settings:{title:'Una oportunidad. Un gran premio.',prize:'Gran premio Dunamis',description:'Participa, comparte la ilusión y apoya nuestra comunidad. Elige tu número y prepárate para celebrar.',image:'assets/premio.svg',price:10000,total:100,drawAt:new Date(now+15*86400000).toISOString(),automatic:false},sellers:[],tickets:{},winner:null};}
export const phoneDigits=value=>String(value).replace(/\D/g,'');
export function validateBuyer(name,phone){if(String(name).trim().length<3)throw Error('Escribe el nombre completo del comprador (mínimo 3 caracteres).');if(!/^\+?[\d\s()-]{7,22}$/.test(String(phone))||phoneDigits(phone).length<7||phoneDigits(phone).length>15)throw Error('Ingresa un celular válido de 7 a 15 dígitos.');}
export function isClosed(s,now=Date.now()){return !!s.winner||now>=Date.parse(s.settings.drawAt);}
export function updateTicket(s,{number,sellerId,status,name='',phone=''},now=Date.now()){
 if(isClosed(s,now))throw Error('La venta está cerrada: llegó la fecha del sorteo.');
 if(!Number.isInteger(number)||number<0||number>=s.settings.total)throw Error('Número fuera del tablero.');
 if(!s.sellers.some(x=>x.id===sellerId))throw Error('Selecciona un vendedor.');
 const previous=s.tickets[number];if(previous&&previous.sellerId!==sellerId)throw Error('Este número pertenece a otro vendedor.');
 if(!['reserved','paid','free'].includes(status))throw Error('Estado inválido.');
 if(status==='paid'||name.trim()||phone.trim())validateBuyer(name,phone);
 if(status==='free'){delete s.tickets[number];return;}
 s.tickets[number]={number,sellerId,status,name:name.trim(),phone:phone.trim(),updatedAt:new Date(now).toISOString()};
}
export function eligible(s){return Object.values(s.tickets).filter(t=>t.status==='paid').sort((a,b)=>a.number-b.number);}
export function secureIndex(length,cryptoSource=globalThis.crypto){if(!Number.isInteger(length)||length<1)throw Error('No hay números pagados para sortear.');const range=2**32,limit=range-range%length;const buf=new Uint32Array(1);do{cryptoSource.getRandomValues(buf);}while(buf[0]>=limit);return buf[0]%length;}
export function draw(s,now=Date.now(),cryptoSource=globalThis.crypto){if(s.winner)throw Error('Esta rifa ya tiene un ganador.');if(now<Date.parse(s.settings.drawAt))throw Error('El sorteo estará disponible en la fecha programada.');const pool=eligible(s);if(!pool.length)throw Error('No hay números pagados para sortear.');const selected=pool[secureIndex(pool.length,cryptoSource)];s.winner={number:selected.number,drawnAt:new Date(now).toISOString(),eligible:pool.map(t=>t.number)};return s.winner;}
export function stats(s){const entries=Object.values(s.tickets),paid=entries.filter(t=>t.status==='paid');return{paid:paid.length,reserved:entries.length-paid.length,free:s.settings.total-entries.length,buyers:new Set(entries.filter(t=>t.phone).map(t=>phoneDigits(t.phone))).size,revenue:paid.length*s.settings.price};}
export function validateSettings(s,next,now=Date.now()){if(s.winner)throw Error('La configuración está cerrada porque ya existe un ganador.');if(!next.title.trim()||!next.prize.trim())throw Error('Completa el título y el premio.');if(!Number.isInteger(next.total)||next.total<10||next.total>1000)throw Error('La cantidad debe estar entre 10 y 1.000 números.');if(!Number.isFinite(next.price)||next.price<100||next.price>100000000)throw Error('Escribe un valor por número entre $100 y $100.000.000.');if(!Number.isFinite(Date.parse(next.drawAt))||Date.parse(next.drawAt)<=now)throw Error('Programa una fecha futura.');if(Object.keys(s.tickets).some(n=>Number(n)>=next.total))throw Error('No puedes quitar números que ya están reservados o pagados.');if(Object.keys(s.tickets).length&&next.price!==s.settings.price)throw Error('El valor no puede cambiar después de registrar reservas o pagos.');}
