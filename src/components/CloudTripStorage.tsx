import { useState } from 'react'
import { loadCloudTrips, saveCloudTrip } from '../services/cloudTrips'
import { readSavedPlans, TRIP_SAVED_PLANS_STORAGE, type GeneratedPlan } from '../services/trip/planner'
import { writeVersioned } from '../services/storage'

export function CloudTripStorage({plans}:{plans:GeneratedPlan[]}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await action()}catch(cause){setMessage(cause instanceof Error?cause.message:'云端连接失败，本机记录保留。')}finally{setBusy(false)}}
  return <details className="cloud-trip-storage"><summary>本机行程与云端保存</summary>
    <p>列表先显示本机副本。点击下方按钮后才上传私人行程；只有服务器确认后才显示云端已保存。访客身份有效30天，换设备、退出或清除Cookie后不能找回。</p>
    <button type="button" disabled={busy||!plans.length} onClick={()=>void run(async()=>{
      let done=0
      for(const plan of plans){try{await saveCloudTrip(plan);done++}catch(cause){throw Error(`已确认${done}/${plans.length}份云端保存；其余本机记录保留。${cause instanceof Error?cause.message:''}`)}}
      setMessage(`服务器已确认${done}份行程保存。不会自动公开，也不会创建分享链接。`)
    })}>{busy?'正在连接…':'将本机行程保存到云端'}</button>
    <button type="button" disabled={busy} onClick={()=>void run(async()=>{
      const remote=await loadCloudTrips(),local=readSavedPlans()??[]
      const additions=remote.filter(plan=>!local.some(item=>item.tripId===plan.tripId))
      if(additions.length&&!writeVersioned(TRIP_SAVED_PLANS_STORAGE,[...local,...additions],'local'))throw Error('本机空间不足，未导入云端副本。')
      window.dispatchEvent(new Event('zouzou-saved-trips-updated'))
      setMessage(`读取到${remote.length}份云端行程，补入${additions.length}份。本机已有同ID版本不自动覆盖。`)
    })}>读取当前访客的云端行程</button>
    <p role="status">{message}</p>
  </details>
}
