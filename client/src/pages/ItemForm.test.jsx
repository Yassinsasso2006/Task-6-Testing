// Frontend tests for the ItemForm page — THIS is the only frontend file you edit.
// Run with:  npm test --workspace client
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ItemForm from './ItemForm.jsx'
import { api } from '../api'

// Replace the real axios instance with fake (mock) functions — no server needed.
// In a test you decide what each one returns, e.g.
//   api.post.mockResolvedValue({ data: { item: {} } })                                  // success
//   api.post.mockRejectedValue({ response: { status: 409, data: { message: '...' } } }) // failure
// and afterwards check how it was called:
//   expect(api.post).toHaveBeenCalledWith('/items', { ... })
jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() }
}))

// Helper: renders ItemForm at `path`. "/items/new" = report mode, "/items/<id>" = edit mode.
// After a successful save the page navigates to /items, which renders the text "Items page".
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/items/new" element={<ItemForm />} />
        <Route path="/items/:id" element={<ItemForm />} />
        <Route path="/items" element={<div>Items page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// Reset every mock's calls and return values before each test.
beforeEach(() => jest.clearAllMocks())

describe('ItemForm — report mode (/items/new)', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('renders all fields with their default values', () => {
    renderAt('/items/new')
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/title/i)).toHaveValue('')
    const [status, category] = screen.getAllByRole('combobox') // the two <select>s
    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  // `async` allows user-event actions and the component's async save to finish.
  test('submitting POSTs the editable fields and navigates to /items', async () => {
    // Arrange: create the simulated user's interaction controller.
    const user = userEvent.setup()
    // Tell the mocked API that saving succeeds, so the component should navigate afterward.
    api.post.mockResolvedValue({ data: { item: {} } })
    // Render the form in report mode at the route used to create a new item.
    renderAt('/items/new')

    // Locate the title field by its visible placeholder and type a value into it.
    await user.type(screen.getByPlaceholderText(/title/i), 'I WILL RULE THE WORLD')

    // The first combobox is the status select; choose a non-default value.
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'found')
    
    // The second combobox is the category select; choose an allowed category.
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'accessories')
    
    // Locate the location field by placeholder and enter the place where it was found.
    await user.type(screen.getByPlaceholderText(/location/i), 'Main Hall')
    
    // Locate the description textarea by placeholder and enter a short description.
    await user.type(screen.getByPlaceholderText(/description/i), 'NAY THE GALAXY SHALL BE MINE')
    
    // Click the form's submit button; this runs onSubmit and calls the mocked API.
    await user.click(screen.getByRole('button', { name: /save/i }))

    // Assert: the POST endpoint and body match exactly, including no reporter field.
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'I WILL RULE THE WORLD', // The value entered into the title input.
      status: 'found', // The selected item status.
      category: 'accessories', // The selected item category.
      location: 'Main Hall', // The value entered into the location input.
      description: 'NAY THE GALAXY SHALL BE MINE' // The value entered into the description textarea.
    })
    // The success route renders this text, proving navigation completed.
    expect(await screen.findByText('Items page')).toBeInTheDocument()
  })

  // This covers the failed request path and checks the user remains on the form.
  test('shows the server message when saving fails and stays on the page', async () => {
    // Arrange: create a user-event controller for realistic field entry and clicking.
    const user = userEvent.setup()
    // Configure the fake POST to reject just like an HTTP error response from the server.
    api.post.mockRejectedValue({
      response: { data: { message: 'Duplicate item at this location' } }
    })
    // Render the report form; it is the page expected to remain visible after failure.
    renderAt('/items/new')

    // Act: provide the required item fields so submission reaches the mocked API.
    await user.type(screen.getByPlaceholderText(/title/i), 'Danny Phantom / Inviso-Bill')
    await user.type(screen.getByPlaceholderText(/location/i), 'City Hall')
    // Submit the form, which receives the configured rejection and displays its message.
    await user.click(screen.getByRole('button', { name: /save/i }))

    // Assert: findByText waits for React to render the asynchronous error message.
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    // `queryByText` returns null when absent, so this verifies success navigation did not happen.
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
  })
})
