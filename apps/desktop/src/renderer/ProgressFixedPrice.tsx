import type { Lifetime, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { messages } from './messages.ts'
import type { Section } from './sections.ts'

type Props = {
  api: Pick<OctoApi, 'forecastLifetime'>
  project: Project
  onOpenSection?: ((section: Section) => void) | undefined
  /** Opens the form of the client all the same, for a fixed price that has one to fill. */
  onUseForm: () => void
}

const text = messages.progress.fixedPrice
const { money, share } = messages.forecast
const amount = (value: number | null): string => (value === null ? text.unknown : money(value))

/**
 * How far a project sold at a fixed price is with its invoices, as the company's system says: an
 * advance and a balance have no form of the client to fill and no positions of an order to split.
 */
export function ProgressFixedPrice({ api, project, onOpenSection, onUseForm }: Props) {
  const [codes, setCodes] = useState<Lifetime[] | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    setCodes(null)
    setError(null)
    void api.forecastLifetime(project.id).then((result) => {
      if (result.ok) setCodes(result.value.filter((code) => code.kind === 'fixed_price'))
      else setError(result.code)
    })
  }, [api, project.id])

  if (error) return <Failure code={error} onOpen={onOpenSection} />
  if (codes === null) return <p className="progress">{text.loading}</p>
  return (
    <div className="dashboard">
      <p className="hint">{text.intro}</p>
      <div className="table-wide">
        <table aria-label={text.title}>
          <thead>
            <tr>
              <th scope="col">{text.code}</th>
              <th scope="col" className="amount">
                {text.ordered}
              </th>
              <th scope="col" className="amount">
                {text.invoiced}
              </th>
              <th scope="col" className="amount">
                {text.toInvoice}
              </th>
              <th scope="col" className="amount">
                {text.recognized}
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => {
              const { ordered, invoiced, recognized } = code
              const left = ordered !== null && invoiced !== null ? ordered - invoiced : null
              const ofOrder = (value: number | null): string =>
                value !== null && ordered
                  ? `${money(value)} (${share(value / ordered)})`
                  : amount(value)
              return (
                <tr key={code.code}>
                  <th scope="row">
                    {code.code}
                    {code.description !== '' && (
                      <span className="hint code-name">{code.description}</span>
                    )}
                  </th>
                  <td className="amount">{amount(ordered)}</td>
                  <td className="amount">{ofOrder(invoiced)}</td>
                  <td className="amount">{ofOrder(left)}</td>
                  <td className="amount">{ofOrder(recognized)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {codes.some((code) => code.invoiced === null) && <p className="hint">{text.notRead}</p>}
      <div className="actions">
        {onOpenSection && (
          <button type="button" onClick={() => onOpenSection('forecast')}>
            {messages.openSection(messages.forecastTab)}
          </button>
        )}
        <button type="button" className="quiet" onClick={onUseForm}>
          {text.useForm}
        </button>
      </div>
    </div>
  )
}
