import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const app = express();
app.use(express.json({limit:'64kb'}));

const {
  EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID,
  PUBLIC_BASE_URL, OPENAI_API_KEY, OPENAI_REALTIME_MODEL='gpt-realtime-2.1', PORT=8080
} = process.env;

function required(name, value){ if(!value || value.startsWith('YOUR_')) throw new Error(`${name} is not configured`); }

function cleanPhone(p){ return String(p||'').replace(/[^+0-9]/g,''); }
function esc(v){ return String(v??'').replace(/[<>]/g,''); }
function b64(buf){ return Buffer.from(buf).toString('base64'); }
function fromB64(s){ return Buffer.from(s,'base64'); }

// Exotel sends raw/slin 16-bit little-endian PCM at 8 kHz. OpenAI Realtime
// accepts G.711 PCMU at telephony rates, so convert without external codecs.
function pcm16ToUlaw(buf){
  const out=Buffer.alloc(Math.floor(buf.length/2));
  for(let i=0,j=0;i+1<buf.length;i+=2,j++){
    let x=buf.readInt16LE(i);
    let sign=(x<0)?0x80:0; if(sign)x=-x;
    if(x>32635)x=32635;
    let exp=7; for(let mask=0x4000; exp>0 && (x&mask)===0; exp--,mask>>=1){}
    const mant=(x>>(exp+3))&0x0f;
    out[j]=~(sign|(exp<<4)|mant)&0xff;
  }
  return out;
}
function ulawToPcm16(buf){
  const out=Buffer.alloc(buf.length*2);
  for(let i=0;i<buf.length;i++){
    let u=(~buf[i])&0xff;
    const sign=u&0x80;
    const exp=(u>>4)&7;
    const mant=u&15;
    let sample=((mant<<3)+0x84)<<exp;
    sample-=0x84;
    if(sign)sample=-sample;
    out.writeInt16LE(Math.max(-32768,Math.min(32767,sample)),i*2);
  }
  return out;
}

app.get('/health',(req,res)=>res.json({ok:true,service:'SAFETY FIRST emergency voice'}));
app.post('/exotel/status',(req,res)=>{ console.log('Exotel status', req.body); res.sendStatus(204); });

app.post('/sos', async (req,res)=>{
  try{
    required('EXOTEL_ACCOUNT_SID',EXOTEL_ACCOUNT_SID);
    required('EXOTEL_API_KEY',EXOTEL_API_KEY);
    required('EXOTEL_API_TOKEN',EXOTEL_API_TOKEN);
    required('EXOTEL_CALLER_ID',EXOTEL_CALLER_ID);
    required('PUBLIC_BASE_URL',PUBLIC_BASE_URL);
    const {contactPhone,userName='the user',latitude,longitude}=req.body||{};
    const to=cleanPhone(contactPhone);
    if(!/^\+?\d{10,15}$/.test(to)) return res.status(400).json({ok:false,error:'Invalid SOS contact phone'});
    const lat=Number(latitude), lon=Number(longitude);
    const hasLocation=Number.isFinite(lat)&&Number.isFinite(lon);
    const params=new URLSearchParams({
      name:String(userName).slice(0,80),
      lat:hasLocation?String(lat):'',
      lon:hasLocation?String(lon):''
    });
    const base=PUBLIC_BASE_URL.replace(/\/$/,'').replace(/^https:\/\//,'').replace(/^http:\/\//,'');
    const streamUrl=`wss://${base}/stream?sample-rate=8000&${params.toString()}`;
    const body=new URLSearchParams({
      From:to,
      CallerId:EXOTEL_CALLER_ID,
      StreamUrl:streamUrl,
      StreamType:'bidirectional',
      CallType:'trans',
      TimeLimit:'600',
      StatusCallback:`${PUBLIC_BASE_URL.replace(/\/$/,'')}/exotel/status`,
      'StatusCallbackEvents[]':'terminal'
    });
    const auth=Buffer.from(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`).toString('base64');
    const r=await fetch(`https://api.in.exotel.com/v1/Accounts/${encodeURIComponent(EXOTEL_ACCOUNT_SID)}/Calls/connect`,{
      method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body
    });
    const text=await r.text();
    if(!r.ok) return res.status(502).json({ok:false,error:'Exotel call request failed',detail:text.slice(0,1000)});
    res.json({ok:true,message:'Emergency voice call requested',providerResponse:text.slice(0,1000)});
  }catch(e){
    console.error(e); res.status(500).json({ok:false,error:e.message});
  }
});

const server=http.createServer(app);
const wss=new WebSocketServer({server,path:'/stream'});

wss.on('connection',(exo,request)=>{
  if(!OPENAI_API_KEY){exo.close(1011,'OPENAI_API_KEY not configured');return;}
  const u=new URL(request.url,'http://localhost');
  const name=esc(u.searchParams.get('name')||'the user');
  const lat=u.searchParams.get('lat'), lon=u.searchParams.get('lon');
  const location=(lat&&lon)?`https://maps.google.com/?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`:'Location is not available yet.';
  const context=`Emergency context: ${name} activated SAFETY FIRST SOS. The caller may be unable to speak. Current coordinates: ${lat||'unknown'}, ${lon||'unknown'}. Location link: ${location}.`;

  const ai=new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`,{
    headers:{Authorization:`Bearer ${OPENAI_API_KEY}`}
  });
  let ready=false;
  let exotelEncoding='audio/x-pcm;rate=8000';

  ai.on('open',()=>{
    ai.send(JSON.stringify({type:'session.update',session:{
      type:'realtime',model:OPENAI_REALTIME_MODEL,output_modalities:['audio'],
      instructions:`You are SAFETY FIRST Emergency Voice Assistant. This is an emergency call to a trusted contact. Speak calmly, clearly, briefly, and never invent facts. First announce that SAFETY FIRST SOS was activated and the user may be unable to speak. Give the known location and the map link verbally. Ask the contact to stay available and assist the user. If the contact speaks, answer briefly using only the emergency context and what the contact tells you. Do not claim police or ambulance has been dispatched. Do not tell the contact that AI has contacted authorities. ${context}`,
      audio:{input:{format:{type:'audio/pcmu'},turn_detection:{type:'server_vad',silence_duration_ms:500,create_response:true,interrupt_response:true}},output:{format:{type:'audio/pcmu'},voice:'marin'}}
    }}));
  });

  ai.on('message',(raw)=>{
    let ev; try{ev=JSON.parse(raw.toString())}catch{return;}
    if(ev.type==='session.updated' && !ready){
      ready=true;
      ai.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:`Start the emergency announcement now. ${context}`}]}}));
      ai.send(JSON.stringify({type:'response.create',response:{output_modalities:['audio']}}));
    }
    if(ev.type==='response.output_audio.delta' && ev.delta && exo.readyState===WebSocket.OPEN){
      const ulaw=fromB64(ev.delta);
      const output = /mulaw|pcmu|g711/i.test(exotelEncoding) ? ulaw : ulawToPcm16(ulaw);
      exo.send(JSON.stringify({event:'media',stream_sid:exo.streamSid,media:{payload:b64(output)}}));
    }
    if(ev.type==='error') console.error('OpenAI realtime error',ev.error);
  });
  ai.on('close',()=>{if(exo.readyState===WebSocket.OPEN) exo.close();});
  ai.on('error',e=>console.error('OpenAI WS error',e.message));

  exo.on('message',(raw)=>{
    let ev; try{ev=JSON.parse(raw.toString())}catch{return;}
    if(ev.event==='start'){
      exo.streamSid=ev.stream_sid || ev.start?.stream_sid;
      exotelEncoding = String(ev.start?.media_format?.encoding || 'audio/x-pcm').toLowerCase();
    } else if(ev.event==='media' && ev.media?.payload && ai.readyState===WebSocket.OPEN){
      const incoming=fromB64(ev.media.payload);
      const ulaw = /mulaw|pcmu|g711/i.test(exotelEncoding) ? incoming : pcm16ToUlaw(incoming);
      ai.send(JSON.stringify({type:'input_audio_buffer.append',audio:b64(ulaw)}));
    } else if(ev.event==='stop'){
      if(ai.readyState===WebSocket.OPEN) ai.close();
    }
  });
  exo.on('close',()=>{if(ai.readyState===WebSocket.OPEN) ai.close();});
  exo.on('error',e=>console.error('Exotel WS error',e.message));
});

server.listen(PORT,()=>console.log(`SAFETY FIRST emergency voice backend listening on :${PORT}`));
