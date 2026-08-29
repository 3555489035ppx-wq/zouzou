import type { SVGProps } from 'react'

type ZouLogoProps = SVGProps<SVGSVGElement> & { walking?: boolean }

export const ZouLogo = ({ walking = false, ...props }: ZouLogoProps) => (
  <svg viewBox={walking ? '0 0 120 160' : '0 0 64 72'} aria-hidden="true" {...props}>
    {walking ? <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="61" cy="19" r="13" fill="currentColor" stroke="none" />
      <path d="M56 45c6-5 17-5 22 2 3 4 2 11-1 19l-8 21" fill="currentColor" stroke="none" />
      <path d="M57 49c-10 4-17 12-22 25" strokeWidth="14" />
      <path d="M75 47c8 7 16 12 27 13" strokeWidth="14" />
      <path d="M67 82c-2 17-9 30-21 40-8 7-17 12-27 16" strokeWidth="18" />
      <path d="M69 82c13 6 22 14 28 26 5 9 7 18 9 29" strokeWidth="18" />
    </g> : <g>
      <circle cx="34" cy="10" r="8.5" fill="currentColor" />
      <path d="M31 20c6-1 11 2 12 7l2 17c.4 4-2 7-6 8l-9 1c-4 .4-7-2-7-6l-1-18c-.3-5 3-8 9-9Z" fill="currentColor" />
      <path d="M25 29 14 39" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M41 29 50 42" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M30 50 24 67" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <path d="M39 50 44 67" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </g>}
  </svg>
)
