export type BotState = 'idle' | 'listening' | 'reading' | 'thinking' | 'planning' | 'updating' | 'done' | 'success' | 'alert' | 'error' | 'walking' | 'arriving' | 'waiting' | 'paused' | 'transport' | 'completed'
export type BotPose = { scaleX:number; scaleY:number; rotate:number; lift:number; eyeX:number; eyeY:number; eyeScale:number; mouth:number; orbit:number }
const TAU=Math.PI*2, clamp=(v:number)=>Math.max(0,Math.min(1,v)), lerp=(a:number,b:number,t:number)=>a+(b-a)*t, easeOut=(t:number)=>1-Math.pow(1-clamp(t),5)
const idle:BotPose={scaleX:1,scaleY:1,rotate:0,lift:0,eyeX:0,eyeY:0,eyeScale:1,mouth:.5,orbit:0}
const targetFor=(state:BotState,t:number):BotPose=>{const breath=Math.sin(t*TAU*.58),quick=Math.sin(t*TAU*1.9);switch(state){
case'listening':return{...idle,scaleX:1.04,scaleY:.96,rotate:-3,lift:breath,eyeX:-2,eyeY:-1,eyeScale:1.16,mouth:.28,orbit:-8}
case'reading':return{...idle,scaleX:.96,scaleY:1.05,rotate:3,lift:breath*.7,eyeX:2.4,eyeY:quick*1.2,eyeScale:.86,mouth:.38,orbit:12}
case'thinking':return{...idle,scaleX:1+breath*.035,scaleY:1-breath*.035,rotate:quick*2.2,lift:-Math.abs(breath)*2,eyeX:quick*2,eyeY:-2,eyeScale:.72,mouth:.18,orbit:t*68%360}
case'planning':case'updating':return{...idle,scaleX:1.05,scaleY:.95,rotate:quick*4,lift:-Math.abs(quick)*2.4,eyeX:2,eyeY:0,eyeScale:.9,mouth:.58,orbit:t*150%360}
case'walking':case'transport':return{...idle,scaleX:1.06,scaleY:.94,rotate:7+quick*3,lift:-Math.abs(quick)*3,eyeX:3,eyeY:0,eyeScale:.86,mouth:.55,orbit:t*210%360}
case'arriving':case'done':case'success':case'completed':return{...idle,scaleX:1.08,scaleY:.92,rotate:0,lift:-4+breath,eyeX:0,eyeY:-1,eyeScale:1.12,mouth:1,orbit:28}
case'alert':return{...idle,scaleX:1.08,scaleY:.91,rotate:-5,lift:0,eyeX:-2,eyeY:-3,eyeScale:1.25,mouth:.12,orbit:-20}
case'error':return{...idle,scaleX:1.08,scaleY:.92,rotate:-7,lift:2,eyeX:-2,eyeY:2,eyeScale:.76,mouth:-.5,orbit:0}
case'waiting':case'paused':return{...idle,scaleX:1.02,scaleY:.98,rotate:-2,lift:breath*.5,eyeX:-2,eyeY:0,eyeScale:.94,mouth:.36,orbit:0}
default:return{...idle,scaleX:1+breath*.018,scaleY:1-breath*.018,lift:breath*.8,eyeY:breath*.3}}}
const mix=(a:BotPose,b:BotPose,t:number):BotPose=>({scaleX:lerp(a.scaleX,b.scaleX,t),scaleY:lerp(a.scaleY,b.scaleY,t),rotate:lerp(a.rotate,b.rotate,t),lift:lerp(a.lift,b.lift,t),eyeX:lerp(a.eyeX,b.eyeX,t),eyeY:lerp(a.eyeY,b.eyeY,t),eyeScale:lerp(a.eyeScale,b.eyeScale,t),mouth:lerp(a.mouth,b.mouth,t),orbit:lerp(a.orbit,b.orbit,t)})
export class ZouBotEngine{private state:BotState;private from:BotPose;private transitionAt=0;private pausedAt:number|null=null;private pauseOffset=0;constructor(initial:BotState='idle'){this.state=initial;this.from=targetFor(initial,0)}sample(timeSeconds:number){const time=this.pausedAt??timeSeconds,local=Math.max(0,time-this.pauseOffset);return mix(this.from,targetFor(this.state,local-this.transitionAt),easeOut((local-this.transitionAt)/.32))}setState(next:BotState,timeSeconds:number){if(next===this.state)return;this.from=this.sample(timeSeconds);this.state=next;this.transitionAt=timeSeconds-this.pauseOffset}pause(timeSeconds:number){if(this.pausedAt===null)this.pausedAt=timeSeconds}resume(timeSeconds:number){if(this.pausedAt!==null){this.pauseOffset+=timeSeconds-this.pausedAt;this.pausedAt=null}}reset(next:BotState,timeSeconds:number){this.state=next;this.from=targetFor(next,0);this.transitionAt=timeSeconds;this.pauseOffset=0;this.pausedAt=null}}
export const MotionEngine=ZouBotEngine
