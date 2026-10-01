import {describe, expect, it} from '@jest/globals';

import type {DadosTransacao} from '../src/domain/entities/Transacao';
import {validarTransacao} from '../src/domain/validacao/validarTransacao';

const valida: DadosTransacao = {
  tipo: 'receita',
  valorCentavos: 850000,
  categoria: 'salario',
  descricao: 'Salário da empresa',
  data: '2026-09-30',
  recorrencia: 'fixa',
};

describe('validarTransacao', () => {
  it('aceita uma receita válida', () => {
    const resultado = validarTransacao(valida);
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual({});
    expect(resultado.dados).toEqual(valida);
  });

  it('recusa valor zero ou negativo', () => {
    expect(
      validarTransacao({...valida, valorCentavos: 0}).erros.valorCentavos,
    ).toBeDefined();
    expect(
      validarTransacao({...valida, valorCentavos: -100}).erros.valorCentavos,
    ).toBeDefined();
    expect(
      validarTransacao({...valida, valorCentavos: 10.5}).erros.valorCentavos,
    ).toBeDefined();
  });

  it('exige categoria do tipo da transação', () => {
    const semCategoria = validarTransacao({...valida, categoria: ''});
    expect(semCategoria.valido).toBe(false);
    expect(semCategoria.erros.categoria).toBe('Escolha uma categoria.');
    expect(
      validarTransacao({...valida, categoria: 'alimentacao'}).erros.categoria,
    ).toBeDefined();
  });

  it('limita a descrição a 80 caracteres', () => {
    expect(
      validarTransacao({...valida, descricao: 'a'.repeat(80)}).valido,
    ).toBe(true);
    const longa = validarTransacao({...valida, descricao: 'a'.repeat(81)});
    expect(longa.valido).toBe(false);
    expect(longa.erros.descricao).toMatch(/80/);
  });

  it('usa o label da categoria quando a descrição vem vazia', () => {
    const resultado = validarTransacao({...valida, descricao: '   '});
    expect(resultado.valido).toBe(true);
    expect(resultado.dados.descricao).toBe('Salário');
  });

  it('recusa data inválida', () => {
    expect(validarTransacao({...valida, data: '2026-02-30'}).erros.data).toBe(
      'Informe uma data válida (AAAA-MM-DD).',
    );
    expect(
      validarTransacao({...valida, data: '30/09/2026'}).erros.data,
    ).toBeDefined();
  });
});
