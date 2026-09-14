import { createContext, useContext, type ReactNode } from 'react'

// Keep trip context inside the page scroll area and below its navigation title.
export const TripScopeHeaderContext = createContext<ReactNode>(null)
export const TripScopeHeader = () => useContext(TripScopeHeaderContext)
