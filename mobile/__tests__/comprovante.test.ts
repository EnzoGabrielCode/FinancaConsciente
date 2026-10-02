import {describe, expect, it} from '@jest/globals';

import {validarImagemComprovante} from '../src/domain/comprovante';

const MB = 1024 * 1024;

describe('validarImagemComprovante', () => {
  it('aceita JPEG', () => {
    expect(
      validarImagemComprovante({tipoMime: 'image/jpeg', tamanhoBytes: 2 * MB}),
    ).toBeNull();
  });

  it('aceita PNG', () => {
    expect(
      validarImagemComprovante({tipoMime: 'image/png', tamanhoBytes: MB}),
    ).toBeNull();
  });

  it('recusa GIF', () => {
    expect(
      validarImagemComprovante({tipoMime: 'image/gif', tamanhoBytes: MB}),
    ).toBe('Formato não suportado. Use JPG ou PNG.');
  });

  it('recusa foto de 11 MB', () => {
    expect(
      validarImagemComprovante({tipoMime: 'image/jpeg', tamanhoBytes: 11 * MB}),
    ).toBe('A foto passa de 10 MB.');
  });

  it('aceita quando o tamanho não é informado', () => {
    expect(validarImagemComprovante({tipoMime: 'image/png'})).toBeNull();
  });
});
