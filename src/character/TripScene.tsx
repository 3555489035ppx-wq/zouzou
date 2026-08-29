import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Place } from '../demo-data/trips'
import { sceneColors } from '../design-system/colors'

export type TripSceneState = 'waiting' | 'walking' | 'transport' | 'arriving' | 'paused' | 'completed'

const interpolateRoute = (places: Place[], progress: number) => {
  if (places.length < 2) return new THREE.Vector3(0, 0.25, 0)
  const scaled = Math.min(0.9999, Math.max(0, progress)) * (places.length - 1)
  const index = Math.floor(scaled)
  const local = scaled - index
  const from = places[index]
  const to = places[Math.min(index + 1, places.length - 1)]
  return new THREE.Vector3(THREE.MathUtils.lerp(from.x, to.x, local), 0.31, THREE.MathUtils.lerp(from.z, to.z, local))
}

const Landmark = ({ place, index, active }: { place: Place; index: number; active: boolean }) => {
  const shape = index % 4
  return <group position={[place.x, 0, place.z]} scale={active ? 1.15 : 1}>
    {shape === 0 ? <><mesh position={[0, 0.24, 0]}><boxGeometry args={[0.62, 0.48, 0.5]} /><meshStandardMaterial color={active ? sceneColors.ink : sceneColors.landmark} /></mesh><mesh position={[0, 0.56, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.48, 0.48, 0.48]} /><meshStandardMaterial color={sceneColors.highlight} /></mesh></> : null}
    {shape === 1 ? <><mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.18, 0.25, 0.52, 8]} /><meshStandardMaterial color={active ? sceneColors.landmarkActive : sceneColors.landmarkAlt} /></mesh><mesh position={[0, 0.63, 0]}><coneGeometry args={[0.44, 0.72, 8]} /><meshStandardMaterial color={sceneColors.highlightSoft} /></mesh></> : null}
    {shape === 2 ? <><mesh position={[0, 0.22, 0]}><boxGeometry args={[0.76, 0.44, 0.58]} /><meshStandardMaterial color={active ? sceneColors.landmarkActiveAlt : sceneColors.landmarkSoft} /></mesh><mesh position={[0, 0.52, 0]}><boxGeometry args={[0.52, 0.18, 0.43]} /><meshStandardMaterial color={sceneColors.highlightRaised} /></mesh></> : null}
    {shape === 3 ? <><mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.42, 0.48, 0.16, 12]} /><meshStandardMaterial color={sceneColors.grid} /></mesh><mesh position={[0, 0.46, 0]}><sphereGeometry args={[0.38, 12, 8]} /><meshStandardMaterial color={active ? sceneColors.inkRaised : sceneColors.landmarkMuted} /></mesh></> : null}
  </group>
}

const Character = ({ places, progress, paused, state }: { places: Place[]; progress: number; paused: boolean; state: TripSceneState }) => {
  const group = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const target = interpolateRoute(places, progress)
    group.current.position.lerp(target, 1 - Math.exp(-delta * 12))
    const next = interpolateRoute(places, Math.min(1, progress + 0.01))
    const desired = Math.atan2(next.x - target.x, next.z - target.z)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, desired, 1 - Math.exp(-delta * 8))
    const step = paused || state !== 'walking' ? 0 : Math.sin(clock.elapsedTime * 11) * 0.48
    if (leftLeg.current) leftLeg.current.rotation.x = step
    if (rightLeg.current) rightLeg.current.rotation.x = -step
  })
  return <group ref={group}>
    {state === 'transport' ? <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.72, 0.2, 0.48]} /><meshStandardMaterial color={sceneColors.landmarkActive} /></mesh> : null}
    <mesh position={[0, 0.83, 0]}><sphereGeometry args={[0.15, 16, 12]} /><meshStandardMaterial color={sceneColors.ink} /></mesh>
    <mesh position={[0, 0.54, 0]}><capsuleGeometry args={[0.14, 0.3, 6, 12]} /><meshStandardMaterial color={sceneColors.inkSoft} /></mesh>
    <mesh ref={leftLeg} position={[-0.08, 0.25, 0]}><capsuleGeometry args={[0.05, 0.28, 4, 8]} /><meshStandardMaterial color={sceneColors.ink} /></mesh>
    <mesh ref={rightLeg} position={[0.08, 0.25, 0]}><capsuleGeometry args={[0.05, 0.28, 4, 8]} /><meshStandardMaterial color={sceneColors.ink} /></mesh>
    <mesh position={[-0.17, 0.55, 0]} rotation={[0, 0, state === 'completed' ? -1.1 : 0.25]}><capsuleGeometry args={[0.04, 0.22, 4, 8]} /><meshStandardMaterial color={sceneColors.ink} /></mesh>
    <mesh position={[0.17, 0.55, 0]} rotation={[0, 0, state === 'completed' ? 1.1 : -0.25]}><capsuleGeometry args={[0.04, 0.22, 4, 8]} /><meshStandardMaterial color={sceneColors.ink} /></mesh>
  </group>
}

const TripWorld = ({ places, progress, paused, state }: { places: Place[]; progress: number; paused: boolean; state: TripSceneState }) => {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(places.map((place) => new THREE.Vector3(place.x, 0.035, place.z)))
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: sceneColors.route, linewidth: 2 }))
  }, [places])
  const activeIndex = Math.min(places.length - 1, Math.round(progress * (places.length - 1)))
  return <>
    <color attach="background" args={[sceneColors.world]} />
    <ambientLight intensity={2.2} />
    <directionalLight position={[4, 8, 4]} intensity={2.8} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[9, 7]} /><meshStandardMaterial color={sceneColors.ground} roughness={1} /></mesh>
    <gridHelper args={[8, 16, sceneColors.grid, sceneColors.gridSoft]} position={[0, 0, 0]} />
    <primitive object={line} />
    {places.map((place, index) => <Landmark key={place.id} place={place} index={index} active={index === activeIndex} />)}
    <Character places={places} progress={progress} paused={paused} state={state} />
  </>
}

export const TripScene = ({ places, progress, paused = false, state = paused ? 'paused' : 'walking', className = '' }: { places: Place[]; progress: number; paused?: boolean; state?: TripSceneState; className?: string }) => (
  <div className={`trip-scene ${className}`} role="img" aria-label={`上海行程 3D 路线，当前状态：${state}`}>
    <Canvas orthographic camera={{ position: [6, 8, 8], zoom: 58, near: 0.1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }}>
      <TripWorld places={places} progress={progress} paused={paused} state={state} />
    </Canvas>
  </div>
)
