import {describe, expect, it} from '@jest/globals';

import {normalizar, tokenizar} from '../src/domain/texto';

describe('normalizar', () => {
  it('tira acentos e maiúsculas', () => {
    expect(normalizar('AÇOUGUE São João')).toBe('acougue sao joao');
    expect(normalizar('Farmácia, Óculos e Pão')).toBe('farmacia oculos e pao');
  });

  it('troca pontuação e símbolos por espaço', () => {
    expect(normalizar('R$ 89,90 — iFood!!')).toBe('r 89 90 ifood');
    expect(normalizar('mercado-livre/compra')).toBe('mercado livre compra');
  });

  it('texto vazio ou só símbolos vira vazio', () => {
    expect(normalizar('')).toBe('');
    expect(normalizar(' ... !! ')).toBe('');
  });
});

describe('tokenizar', () => {
  it('remove stopwords e palavras de 1 letra', () => {
    expect(tokenizar('Uber para o trabalho')).toEqual(['uber', 'trabalho']);
    expect(tokenizar('jantar com a família no bar')).toEqual([
      'jantar',
      'familia',
      'bar',
    ]);
  });

  it('remove números, menos o 99', () => {
    expect(tokenizar('IPVA 2026 parcela 1')).toEqual(['ipva', 'parcela']);
    expect(tokenizar('99 pro aeroporto')).toEqual(['99', 'pro', 'aeroporto']);
    expect(tokenizar('R$ 99,90')).toEqual(['99']);
  });

  it('mantém palavras com letras e números', () => {
    expect(tokenizar('Smart Fit 24h')).toEqual(['smart', 'fit', '24h']);
  });
});
