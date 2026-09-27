import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('tela de captura', () => {
  it('não afirma salvamento genérico na entrada', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TattooArt' })).toBeTruthy();
    expect(screen.queryByText(/^salvo$/i)).toBeNull();
    expect(screen.queryByText(/^salvo!$/i)).toBeNull();
  });
});
