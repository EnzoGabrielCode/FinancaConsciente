import {buscarCategoria} from '../categorias';
import {dataISOValida} from '../datas';
import type {DadosTransacao} from '../entities/Transacao';

export const MAX_DESCRICAO = 80;

export type ErrosTransacao = Partial<Record<keyof DadosTransacao, string>>;

export interface ResultadoValidacao {
  valido: boolean;
  erros: ErrosTransacao;
  dados: DadosTransacao;
}

export function validarTransacao(dados: DadosTransacao): ResultadoValidacao {
  const erros: ErrosTransacao = {};

  if (dados.tipo !== 'receita' && dados.tipo !== 'despesa') {
    erros.tipo = 'Escolha receita ou despesa.';
  }

  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
    erros.valorCentavos = 'Informe um valor maior que zero.';
  }

  const categoria = buscarCategoria(dados.tipo, dados.categoria);
  if (!categoria) {
    erros.categoria = 'Escolha uma categoria.';
  }

  const descricaoDigitada = dados.descricao.trim();
  if (descricaoDigitada.length > MAX_DESCRICAO) {
    erros.descricao = `A descrição pode ter no máximo ${MAX_DESCRICAO} caracteres.`;
  }

  if (!dataISOValida(dados.data)) {
    erros.data = 'Informe uma data válida (AAAA-MM-DD).';
  }

  if (dados.recorrencia !== 'fixa' && dados.recorrencia !== 'variavel') {
    erros.recorrencia = 'Escolha se a receita é fixa ou variável.';
  }

  if (dados.tipo === 'receita' && dados.comprovanteUri !== null) {
    erros.comprovanteUri = 'Comprovante só pode ser anexado a despesas.';
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: {
      ...dados,
      descricao: descricaoDigitada || categoria?.label || '',
    },
  };
}
