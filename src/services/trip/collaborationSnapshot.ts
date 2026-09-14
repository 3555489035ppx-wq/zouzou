import type {GeneratedPlan} from './planner'

export function collaborationSnapshot(plan:GeneratedPlan):GeneratedPlan {
  return {...plan,previousVersion:undefined,guideContext:undefined,evidence:[],days:Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.map(stop=>({...stop,note:''}))]))}
}
