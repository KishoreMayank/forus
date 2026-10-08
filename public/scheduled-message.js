const DAY=86400000;
export function scheduledMessage(state,c){
 if(!c?.contact||c.sourceStatus==='completed'||!c.appointment||c.appointment.start<=state.now)return null;
 const a=c.appointment,key=`${a.id}:${a.start}`;
 if(c.reminder?.key===key&&c.reminder.sent)return null;
 const prior=new Date(a.start-DAY);
 prior.setUTCHours(17,0,0,0);
 const at=Math.max(state.now,prior.getTime());
 const date=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(a.start);
 const time=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(a.start);
 return {key,at,paused:c.reminder?.key===key&&c.reminder.paused,kind:a.kind==='Discussion'?'discussion reminder':'appointment reminder',text:`Reminder: your ${a.kind==='Discussion'?'discussion':'appointment'} with ${a.provider} is on ${date} at ${time} (${a.duration||60} minutes). Reply here if you need a different time.`};
}
export function updateScheduledMessage(state,c,action){
 const pending=scheduledMessage(state,c);if(!pending)return false;
 if(action==='send'){
  if(pending.paused)return false;
  c.messages.push({id:`${c.id}-m${c.messages.length}`,at:state.now,who:'agent',channel:'text',text:pending.text,sources:[]});
  c.reminder={key:pending.key,sent:true,paused:false};
 }else if(action==='pause'||action==='resume')c.reminder={key:pending.key,sent:false,paused:action==='pause'};
 else return false;
 c.events.push({id:`${c.id}-${c.events.length}`,at:state.now,title:action==='send'?'Reminder sent':action==='pause'?'Reminder paused':'Reminder resumed',detail:action==='send'?'Appointment reminder sent in the scripted demo.':action==='pause'?'The appointment remains booked; its reminder is on hold.':'Appointment reminder returned to the schedule.'});
 return true;
}
