import {describe, expect, it} from '@jest/globals';
import {PDFDocument} from 'pdf-lib';

import {paraWinAnsi, PdfLibGerador} from '../src/data/servicos/PdfLibGerador';
import type {Transacao} from '../src/domain/entities/Transacao';
import {montarRelatorio} from '../src/domain/relatorios';

const filtro = {
  de: '2026-11-01',
  ate: '2026-11-30',
  tipo: 'todos' as const,
  categoria: null,
};

const lancamentos = (quantidade: number): Transacao[] =>
  Array.from({length: quantidade}, (_, i) => ({
    id: i + 1,
    tipo: i % 5 === 0 ? 'receita' : 'despesa',
    descricao: `Lançamento ${i + 1} com uma descrição bem comprida para cortar`,
    valorCentavos: 1000 + i,
    data: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    categoria: i % 5 === 0 ? 'salario' : 'alimentacao',
    recorrencia: 'variavel',
    comprovanteUri: null,
    contaRecorrenteId: null,
    sincronizado: false,
  }));

const gerar = (transacoes: Transacao[]) =>
  new PdfLibGerador().gerar(
    montarRelatorio(filtro, transacoes),
    new Date(2026, 10, 9, 14, 30),
  );

describe('PdfLibGerador', () => {
  it('gera um PDF em base64', async () => {
    const base64 = await gerar(lancamentos(3));
    expect(base64.startsWith('JVBERi0')).toBe(true);
    const documento = await PDFDocument.load(base64);
    expect(documento.getPageCount()).toBe(1);
    expect(documento.getTitle()).toBe('FinançaConsciente - Extrato');
  });

  it('com 200 lançamentos quebra em várias páginas', async () => {
    const documento = await PDFDocument.load(await gerar(lancamentos(200)));
    expect(documento.getPageCount()).toBeGreaterThan(1);
  });

  it('descrição com emoji e quebra de linha não lança', async () => {
    const [primeiro] = lancamentos(1);
    await expect(
      gerar([{...primeiro, descricao: 'Pizza 🍕 com a família ✨\nno sábado'}]),
    ).resolves.toMatch(/^JVBERi0/);
  });

  it('período sem lançamentos também gera', async () => {
    await expect(gerar([])).resolves.toMatch(/^JVBERi0/);
  });

  it('paraWinAnsi mantém acentos e troca o resto por ?', () => {
    expect(paraWinAnsi('Açougue São João — R$ 10 · ok')).toBe(
      'Açougue São João — R$ 10 · ok',
    );
    expect(paraWinAnsi('Pizza 🍕 ✨')).toBe('Pizza ? ?');
    expect(paraWinAnsi('a\nb\tc')).toBe('a b c');
  });
});
