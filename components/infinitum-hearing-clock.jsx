'use client';
import {hearingClockLines} from '../lib/infinitum-hearing-clock.mjs';
export default function HearingClock({clock,endClock,compact=false}){
 const times=hearingClockLines(clock),end=endClock?hearingClockLines(endClock):null;
 return <div className="lx-hearing-clock" style={{display:'flex',flexWrap:'wrap',gap:'4px 14px',margin:'4px 0'}}><strong>{times.local}</strong><strong>{times.brasilia}</strong>{end&&<small style={{flexBasis:'100%'}}>Término: {end.local} · {end.brasilia}</small>}{times.note&&<small style={{flexBasis:'100%'}}>{times.note}</small>}</div>;
}
