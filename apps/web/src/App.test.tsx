import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('entrada Tela Viva', () => {
  it('não afirma salvamento genérico na entrada', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Seu dia, em movimento.' })).toBeTruthy();
    expect(screen.queryByText(/^salvo$/i)).toBeNull();
    expect(screen.queryByText(/^salvo!$/i)).toBeNull();
  });
});
