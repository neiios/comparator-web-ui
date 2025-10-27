import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

const renderWithProviders = () => {
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('shows an empty state prompting the user to analyze JSON', () => {
    renderWithProviders()

    expect(
      screen.getByText(
        /paste json and run the analysis to see the diff here/i,
      ),
    ).toBeInTheDocument()
  })

  it('presents an error when the JSON payload is invalid', async () => {
    renderWithProviders()
    const user = userEvent.setup()

    const textarea = screen.getAllByLabelText(/json payload/i)[0] as HTMLTextAreaElement
    await user.type(textarea, 'not json')
    const analyzeButton = screen.getAllByRole('button', { name: /analyze json/i })[0]
    await user.click(analyzeButton)

    expect(
      await screen.findByText(/invalid json: unable to parse input/i),
    ).toBeInTheDocument()
  })

  it('respects ignore paths from the configuration input', async () => {
    renderWithProviders()
    const user = userEvent.setup()

    const loadExampleButton = screen.getAllByRole('button', { name: /load example/i })[0]
    const analyzeButton = screen.getAllByRole('button', { name: /analyze json/i })[0]

    await user.click(loadExampleButton)
    await user.click(analyzeButton)

    expect(await screen.findByText(/no differences detected/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /unified diff/i })).not.toBeInTheDocument()

    const configTextarea = screen.getAllByLabelText(/configuration json/i)[0] as HTMLTextAreaElement
    await user.clear(configTextarea)
    await user.click(analyzeButton)

    expect(await screen.findByText(/3 differences found/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /unified diff/i })).toBeInTheDocument()

    const diffLines = screen.getAllByTestId('unified-diff-line')
    expect(diffLines.some((line) => line.textContent?.trim().startsWith('+'))).toBe(true)
    expect(diffLines.some((line) => line.textContent?.trim().startsWith('-'))).toBe(true)
    expect(diffLines.some((line) => line.textContent?.includes('"currency": "USD"'))).toBe(true)

    expect(screen.getByText('success.price.freeTrialDays')).toBeInTheDocument()
    expect(screen.getByText('success.price.tax')).toBeInTheDocument()
  })
})
