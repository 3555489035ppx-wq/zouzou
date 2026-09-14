import type {TripMedia} from './planner'

// Original screenshots remain on this device. Small references can safely fit
// alongside the text draft; IndexedDB transactions keep the previous set on failure.
const placeholder='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
export const mediaReferences=(media:TripMedia[])=>media.map(item=>({...item,src:placeholder,localImage:true}))
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('zouzou-trip-images-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('draft');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
export async function saveDraftMedia(media:TripMedia[]):Promise<void>{const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(media,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
export async function loadDraftMedia():Promise<TripMedia[]|undefined>{const db=await database();try{return await new Promise((resolve,reject)=>{const request=db.transaction('draft','readonly').objectStore('draft').get('current');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{db.close()}}
export async function resolveDraftMedia(references:TripMedia[]):Promise<TripMedia[]>{
  if(!references.some(item=>(item as TripMedia & {localImage?:boolean}).localImage))return references
  const originals=await loadDraftMedia()??[]
  return references.map(reference=>{const original=originals.find(item=>item.id===reference.id);if(!original)throw new Error('本机原截图已变更，请返回创建页核对附件后重试。');return original})
}
