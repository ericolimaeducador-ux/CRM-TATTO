import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('placeholder da fase 0', () => {
  it('não afirma salvamento genérico', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'captura7' })).toBeTruthy();
    expect(screen.queryByText(/salvo/i)).toBeNull();
  });
});
