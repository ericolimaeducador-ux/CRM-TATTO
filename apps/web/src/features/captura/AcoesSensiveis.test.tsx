import { fireEvent, render, screen } from '@testing-library/react';
import { AcoesSensiveis } from './AcoesSensiveis';

describe('confirmações sensíveis', () => {
  it('cancela e aceita o nome sem diferenciar acento nem maiúscula', () => {
    render(<AcoesSensiveis id="1" nome="Érico" aoAtualizar={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revogar consentimento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar revogação' }));
    expect(screen.queryByRole('button', { name: 'Confirmar revogação' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar titular' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar eliminação' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'erico' } });
    expect((confirmar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar eliminação' }));
    expect(screen.queryByRole('button', { name: 'Confirmar eliminação' })).toBeNull();
  });
});
