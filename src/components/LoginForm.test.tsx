import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getAccountSettings, getStateInstance } from '../api/greenApi'
import { account, credentials } from '../test/fixtures'
import { LoginForm } from './LoginForm'

vi.mock('../api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/greenApi')>()
  return { ...actual, getStateInstance: vi.fn(), getAccountSettings: vi.fn() }
})

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  const apiUrl = screen.getByLabelText('apiUrl')
  await user.type(apiUrl, credentials.apiUrl)
  await user.type(screen.getByPlaceholderText('000000000000'), credentials.idInstance)
  await user.type(screen.getByLabelText('apiTokenInstance'), credentials.apiTokenInstance)
}

describe('LoginForm', () => {
  it('leaves the apiUrl field empty by default', () => {
    render(<LoginForm initial={null} onConnect={vi.fn()} />)

    expect(screen.getByLabelText('apiUrl')).toHaveValue('')
  })

  it('keeps the digits only in the idInstance field', async () => {
    const user = userEvent.setup()
    render(<LoginForm initial={null} onConnect={vi.fn()} />)

    const field = screen.getByPlaceholderText('000000000000')
    await user.type(field, '1234abc22')

    expect(field).toHaveValue('123422')
  })

  it('validates the credentials before calling the API', async () => {
    const user = userEvent.setup()
    render(<LoginForm initial={null} onConnect={vi.fn()} />)

    await user.type(screen.getByLabelText('apiUrl'), credentials.apiUrl)
    await user.type(screen.getByPlaceholderText('000000000000'), '123')
    await user.click(screen.getByRole('button', { name: 'Подключиться' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('apiTokenInstance')
    expect(getStateInstance).not.toHaveBeenCalled()
  })

  it('requires the apiUrl', async () => {
    const user = userEvent.setup()
    render(<LoginForm initial={null} onConnect={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('000000000000'), credentials.idInstance)
    await user.click(screen.getByRole('button', { name: 'Подключиться' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Укажите apiUrl')
    expect(getStateInstance).not.toHaveBeenCalled()
  })

  it('connects with a valid authorized instance', async () => {
    const user = userEvent.setup()
    const onConnect = vi.fn()
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'authorized' })
    vi.mocked(getAccountSettings).mockResolvedValue(account)

    render(<LoginForm initial={null} onConnect={onConnect} />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Подключиться' }))

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(credentials, false))
  })

  it('reports an instance that is not authorized', async () => {
    const user = userEvent.setup()
    const onConnect = vi.fn()
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'notAuthorized' })
    vi.mocked(getAccountSettings).mockResolvedValue({
      phone: '',
      chatId: '',
      avatar: '',
      username: '',
      stateInstance: 'notAuthorized',
    })

    render(<LoginForm initial={null} onConnect={onConnect} />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Подключиться' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован')
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('prefills the form with the stored credentials', () => {
    render(<LoginForm initial={credentials} onConnect={vi.fn()} />)

    expect(screen.getByLabelText('apiTokenInstance')).toHaveValue(credentials.apiTokenInstance)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
