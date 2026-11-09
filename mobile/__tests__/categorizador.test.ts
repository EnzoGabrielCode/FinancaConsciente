import {describe, expect, it} from '@jest/globals';

import {
  CONFIANCA_MINIMA,
  exemplosDoDicionario,
  PESO_DICIONARIO,
  PESO_HISTORICO,
  sugerir,
  treinar,
  type Exemplo,
} from '../src/domain/categorizador';
import {DICIONARIO_INICIAL} from '../src/domain/dicionarioCategorias';
import {normalizar} from '../src/domain/texto';
import {DESCRICOES_ROTULADAS} from './fixtures/descricoes';

const soDicionario = treinar(exemplosDoDicionario());

const categoriaDe = (texto: string) => sugerir(soDicionario, texto)?.categoria;

describe('dicionário inicial', () => {
  it('tem termos normalizados para as 5 categorias, sem "outros"', () => {
    expect(Object.keys(DICIONARIO_INICIAL).sort()).toEqual([
      'alimentacao',
      'compras',
      'lazer',
      'saude',
      'transporte',
    ]);
    for (const termos of Object.values(DICIONARIO_INICIAL)) {
      expect(termos.length).toBeGreaterThanOrEqual(18);
      for (const termo of termos) {
        expect(normalizar(termo)).toBe(termo);
      }
    }
  });

  it('exemplosDoDicionario dá um exemplo por termo com o peso do dicionário', () => {
    const exemplos = exemplosDoDicionario();
    const total = Object.values(DICIONARIO_INICIAL).flat().length;
    expect(exemplos).toHaveLength(total);
    expect(exemplos.every(e => e.peso === PESO_DICIONARIO)).toBe(true);
    expect(exemplos).toContainEqual({
      texto: 'uber',
      categoria: 'transporte',
      peso: PESO_DICIONARIO,
    });
  });
});

describe('sugerir', () => {
  it.each([
    ['Uber para o trabalho', 'transporte'],
    ['iFood pizza', 'alimentacao'],
    ['DROGASIL', 'saude'],
    ['Netflix', 'lazer'],
    ['Renner calça', 'compras'],
  ])('"%s" → %s', (texto, categoria) => {
    const sugestao = sugerir(soDicionario, texto);
    expect(sugestao?.categoria).toBe(categoria);
    expect(sugestao?.confianca).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);
    expect(sugestao?.confianca).toBeLessThanOrEqual(1);
  });

  it('mais palavras da mesma categoria aumentam a confiança', () => {
    const uma = sugerir(soDicionario, 'pizza')!.confianca;
    const duas = sugerir(soDicionario, 'pizza ifood')!.confianca;
    expect(duas).toBeGreaterThan(uma);
  });

  it('sem palavra conhecida ou texto vazio devolve null', () => {
    expect(sugerir(soDicionario, 'xyz 123')).toBeNull();
    expect(sugerir(soDicionario, '')).toBeNull();
    expect(sugerir(soDicionario, '   ')).toBeNull();
  });

  it('empate entre categorias fica abaixo da confiança mínima', () => {
    const empatado = treinar([
      {texto: 'xpto', categoria: 'lazer', peso: 1},
      {texto: 'xpto', categoria: 'saude', peso: 1},
    ]);
    expect(sugerir(empatado, 'xpto')).toBeNull();
    expect(categoriaDe('uber volta da festa')).toBeUndefined();
  });

  it('modelo sem exemplos não sugere', () => {
    expect(sugerir(treinar([]), 'uber')).toBeNull();
  });

  it('aprende com o histórico, que pesa mais que o dicionário', () => {
    expect(categoriaDe('academia smart fit')).toBe('lazer');

    const historico: Exemplo[] = [
      {texto: 'Academia Smart Fit', categoria: 'saude', peso: PESO_HISTORICO},
      {texto: 'Academia Smart Fit', categoria: 'saude', peso: PESO_HISTORICO},
    ];
    const comHistorico = treinar([...exemplosDoDicionario(), ...historico]);

    expect(sugerir(comHistorico, 'academia smart fit')?.categoria).toBe(
      'saude',
    );
    expect(sugerir(comHistorico, 'Netflix')?.categoria).toBe('lazer');
  });

  it('"outros" e categorias desconhecidas nunca são sugeridas', () => {
    const modelo = treinar([
      {texto: 'boleto condominio', categoria: 'outros', peso: 50},
      {texto: 'boleto condominio', categoria: 'inexistente', peso: 50},
      {texto: 'boleto condominio', categoria: 'salario', peso: 50},
    ]);
    expect(modelo.categorias).toEqual([]);
    expect(sugerir(modelo, 'boleto condominio')).toBeNull();

    const misturado = treinar([
      ...exemplosDoDicionario(),
      {texto: 'uber', categoria: 'outros', peso: 100},
    ]);
    expect(sugerir(misturado, 'uber')?.categoria).toBe('transporte');
  });

  it('não estoura com textos longos (softmax estável)', () => {
    const longo = Array(400).fill('pizza ifood mercado').join(' ');
    const sugestao = sugerir(soDicionario, longo);
    expect(sugestao?.categoria).toBe('alimentacao');
    expect(Number.isFinite(sugestao?.confianca)).toBe(true);
  });
});

describe('acurácia com o dicionário inicial', () => {
  it('acerta ao menos 70% das sugeridas e sugere em ao menos 70%', () => {
    const resultados = DESCRICOES_ROTULADAS.map(([texto, esperada]) => ({
      texto,
      esperada,
      sugerida: categoriaDe(texto) ?? null,
    }));
    const comSugestao = resultados.filter(r => r.sugerida !== null);
    const acertos = comSugestao.filter(r => r.sugerida === r.esperada);
    const cobertura = comSugestao.length / resultados.length;
    const acuracia = acertos.length / comSugestao.length;

    const porcentagem = (valor: number) => `${(valor * 100).toFixed(1)}%`;
    const erros = comSugestao
      .filter(r => r.sugerida !== r.esperada)
      .map(
        r => `  "${r.texto}": esperada ${r.esperada}, sugerida ${r.sugerida}`,
      );
    const semSugestao = resultados
      .filter(r => r.sugerida === null)
      .map(r => `  "${r.texto}" (${r.esperada})`);
    console.info(
      [
        `Categorização automática (só dicionário, ${resultados.length} descrições):`,
        `  cobertura: ${comSugestao.length}/${
          resultados.length
        } = ${porcentagem(cobertura)}`,
        `  acurácia entre as sugeridas: ${acertos.length}/${
          comSugestao.length
        } = ${porcentagem(acuracia)}`,
        'Erros:',
        ...erros,
        'Sem sugestão:',
        ...semSugestao,
      ].join('\n'),
    );

    expect(resultados).toHaveLength(60);
    expect(cobertura).toBeGreaterThanOrEqual(0.7);
    expect(acuracia).toBeGreaterThanOrEqual(0.7);
  });

  it('o fixture tem 12 descrições de cada categoria', () => {
    const porCategoria: Record<string, number> = {};
    for (const [, categoria] of DESCRICOES_ROTULADAS) {
      porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1;
    }
    expect(porCategoria).toEqual({
      alimentacao: 12,
      transporte: 12,
      compras: 12,
      saude: 12,
      lazer: 12,
    });
  });
});
