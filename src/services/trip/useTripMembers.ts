import { useEffect, useMemo, useState } from 'react'
import { groupPlanApi } from '../groupPlanApi'
import type { GeneratedPlan } from './planner'

export function useTripMembers(plan?: GeneratedPlan) {
  const groupId=plan?.sourceGroup?.planId
  const local=useMemo(()=>Array.from({length:plan?.partySize??1},(_,i)=>({id:`${plan?.tripId??''}-member-${i}`,name:i===0?'本人':`同行人${i+1}`})),[plan?.tripId,plan?.partySize])
  const [remote,setRemote]=useState<Array<{id:string;name:string}>>([]),[error,setError]=useState(''),[loading,setLoading]=useState(Boolean(groupId)),[retry,setRetry]=useState(0)
  useEffect(()=>{
    if(!groupId)return
    let active=true
    setLoading(true);setError('');setRemote([])
    const update=()=>groupPlanApi.get(groupId).then(group=>{if(active){setRemote(group.participants.filter(member=>member.inviteStatus==='accepted').map(member=>({id:member.id,name:member.displayName})));setLoading(false)}}).catch(cause=>{if(active){setRemote([]);setError(String(cause));setLoading(false)}})
    void update()
    const unsubscribe=groupPlanApi.subscribe(groupId,()=>void update(),()=>{/* A failed authorized refresh must not produce synthetic members. */})
    return()=>{active=false;unsubscribe()}
  },[groupId,retry])
  return {members:groupId?remote:local,shared:Boolean(groupId),loading,error,retry:()=>setRetry(n=>n+1)}
}
