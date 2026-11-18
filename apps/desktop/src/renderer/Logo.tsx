import mark from './octo.png'

type Props = {
  /** The side of the mark, in pixels. */
  size?: number
}

const DEFAULT_SIZE = 28

/**
 * The mark of Octo: the octopus that reads a page. It always sits beside the name, so it says
 * nothing to a reader.
 */
export function Logo({ size = DEFAULT_SIZE }: Props) {
  return <img className="logo" src={mark} width={size} height={size} alt="" aria-hidden="true" />
}
