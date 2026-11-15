type Props = {
  /** The side of the tile, in pixels. */
  size?: number
}

const DEFAULT_SIZE = 28

/**
 * The mark of Octo: an octopus with its eight arms, on a tile of the accent colour. It is drawn
 * with the colours of the theme and always sits beside the name, so it says nothing to a reader.
 */
export function Logo({ size = DEFAULT_SIZE }: Props) {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="logo-tile" width="32" height="32" rx="8" />
      <g className="logo-body">
        <path d="M8.2 15.4a7.8 7.8 0 0 1 15.6 0v2.8H8.2z" />
        <g className="logo-arms">
          <path d="M9.4 17.6C9 21 6.6 21 5 23.2" />
          <path d="M11.3 17.6c0 4.4-2.2 5-3 7.8" />
          <path d="M13.2 17.6c0 4.6-.9 6.2-1.4 9" />
          <path d="M15.1 17.6c0 4.8.2 6.4-.4 9.6" />
          <path d="M16.9 17.6c0 4.8-.2 6.4.4 9.6" />
          <path d="M18.8 17.6c0 4.6.9 6.2 1.4 9" />
          <path d="M20.7 17.6c0 4.4 2.2 5 3 7.8" />
          <path d="M22.6 17.6c.4 3.4 2.8 3.4 4.4 5.6" />
        </g>
      </g>
      <circle className="logo-eye" cx="13" cy="14.2" r="1.35" />
      <circle className="logo-eye" cx="19" cy="14.2" r="1.35" />
    </svg>
  )
}
