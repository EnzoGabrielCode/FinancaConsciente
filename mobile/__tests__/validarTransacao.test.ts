import {describe, expect, it} from '@jest/globals';

import type {DadosTransacao} from '../src/domain/entities/Transacao';
import {validarTransacao} from '../src/domain/validacao/validarTransacao';

const HOJE = '2026-11-08';

const validar = (dados: DadosTransacao) => validarTransacao(dados, HOJE);

const valida: DadosTransacao = {
  tipo: 'receita',
  valorCentavos: 850000,
  categoria: 'salario',
  descricao: 'Salário da empresa',
  data: '2026-09-30',
  recorrencia: 'fixa',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: null,
};

describe('validarTransacao', () => {
  it('aceita uma receita válida', () => {
    const resultado = validar(valida);
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual({});
    expect(resultado.dados).toEqual(valida);
  });

  it('recusa valor zero ou negativo', () => {
    expect(
      validar({...valida, valorCentavos: 0}).erros.valorCentavos,
    ).toBeDefined();
    expect(
      validar({...valida, valorCentavos: -100}).erros.valorCentavos,
    ).toBeDefined();
    expect(
      validar({...valida, valorCentavos: 10.5}).erros.valorCentavos,
    ).toBeDefined();
  });

  it('exige categoria do tipo da transação', () => {
    const semCategoria = validar({...valida, categoria: ''});
    expect(semCategoria.valido).toBe(false);
    expect(semCategoria.erros.categoria).toBe('Escolha uma categoria.');
    expect(
      validar({...valida, categoria: 'alimentacao'}).erros.categoria,
    ).toBeDefined();
  });

  it('limita a descrição a 80 caracteres', () => {
    expect(validar({...valida, descricao: 'a'.repeat(80)}).valido).toBe(true);
    const longa = validar({...valida, descricao: 'a'.repeat(81)});
    expect(longa.valido).toBe(false);
    expect(longa.erros.descricao).toMatch(/80/);
  });

  it('usa o label da categoria quando a descrição vem vazia', () => {
    const resultado = validar({...valida, descricao: '   '});
    expect(resultado.valido).toBe(true);
    expect(resultado.dados.descricao).toBe('Salário');
  });

  it('recusa data inválida', () => {
    expect(validar({...valida, data: '2026-02-30'}).erros.data).toBe(
      'Informe uma data válida (AAAA-MM-DD).',
    );
    expect(validar({...valida, data: '30/09/2026'}).erros.data).toBeDefined();
  });

  it('recusa comprovante em receita', () => {
    const resultado = validar({
      ...valida,
      comprovanteUri: 'file:///docs/comprovantes/a.jpg',
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.comprovanteUri).toBe(
      'Comprovante só pode ser anexado a despesas.',
    );
  });

  it('aceita comprovante em despesa', () => {
    const resultado = validar({
      ...valida,
      tipo: 'despesa',
      categoria: 'alimentacao',
      recorrencia: 'variavel',
      comprovanteUri: 'file:///docs/comprovantes/a.jpg',
    });
    expect(resultado.valido).toBe(true);
    expect(resultado.dados.comprovanteUri).toBe(
      'file:///docs/comprovantes/a.jpg',
    );
  });

  it('aceita a data de hoje e do passado', () => {
    expect(validar({...valida, data: HOJE}).valido).toBe(true);
    expect(validar({...valida, data: '2020-01-01'}).valido).toBe(true);
  });

  it('recusa data no futuro', () => {
    expect(validar({...valida, data: '2026-11-09'}).erros.data).toBe(
      'A data não pode ser no futuro.',
    );
  });

  it('recusa data inexistente antes de olhar o futuro', () => {
    expect(validar({...valida, data: '2026-02-31'}).erros.data).toBe(
      'Informe uma data válida (AAAA-MM-DD).',
    );
  });
});
