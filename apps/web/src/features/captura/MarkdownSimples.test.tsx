import { render } from '@testing-library/react';
import { MarkdownSimples } from './MarkdownSimples';

describe('markdown do termo', () => {
  it('formata negrito, citação e lista sem marcadores crus', () => {
    const { container } = render(
      <MarkdownSimples texto={'**negrito**\n> citação\n☐ item\n- lista'} />,
    );
    const texto = container.textContent ?? '';
    expect(texto).toContain('negrito');
    expect(texto).toContain('citação');
    expect(texto).toContain('lista');
    expect(texto).not.toContain('**');
    expect(texto).not.toContain('☐');
    expect(texto).not.toContain('>');
  });
});
