import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

import {dataISOValida, ultimoDiaDoMes} from '../../domain/datas';
import type {TotaisMes} from '../../domain/entities/Dashboard';
import type {CandidataDuplicata} from '../../domain/entities/Duplicata';
import type {
  DadosTransacao,
  TipoTransacao,
  Transacao,
} from '../../domain/entities/Transacao';
import type {
  ExemploCategoria,
  TransacaoRepository,
} from '../../domain/repositories/TransacaoRepository';

interface LinhaTransacao {
  id: number;
  tipo: Transacao['tipo'];
  descricao: string;
  valor_centavos: number;
  data: string;
  categoria: string;
  recorrencia: Transacao['recorrencia'];
  comprovante_uri: string | null;
  conta_recorrente_id: number | null;
  sincronizado: number;
}

const COLUNAS =
  'id, tipo, descricao, valor_centavos, data, categoria, recorrencia, comprovante_uri, conta_recorrente_id, sincronizado';

const COLUNAS_INSERT = `(tipo, descricao, valor_centavos, data, categoria, recorrencia,
         comprovante_uri, conta_recorrente_id, sincronizado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`;

function parametrosInsert(dados: DadosTransacao): (string | number | null)[] {
  return [
    dados.tipo,
    dados.descricao,
    dados.valorCentavos,
    dados.data,
    dados.categoria,
    dados.recorrencia,
    dados.comprovanteUri,
    dados.contaRecorrenteId,
  ];
}

function paraTransacao(linha: LinhaTransacao): Transacao {
  return {
    id: linha.id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    valorCentavos: linha.valor_centavos,
    data: linha.data,
    categoria: linha.categoria,
    recorrencia: linha.recorrencia,
    comprovanteUri: linha.comprovante_uri ?? null,
    contaRecorrenteId: linha.conta_recorrente_id ?? null,
    sincronizado: linha.sincronizado === 1,
  };
}

interface LinhaTotaisMes {
  ano_mes: string;
  receitas: number | string | null;
  despesas: number | string | null;
}

interface LinhaGastoCategoria {
  categoria: string;
  total: number | string | null;
}

const ANO_MES = /^\d{4}-\d{2}$/;

function validarAnoMes(anoMes: string): void {
  if (!ANO_MES.test(anoMes)) {
    throw new Error(`Mês inválido: ${anoMes}. Use AAAA-MM.`);
  }
}

function linhas<T>(resultado: ResultSet): T[] {
  const lista: T[] = [];
  for (let i = 0; i < resultado.rows.length; i++) {
    lista.push(resultado.rows.item(i) as T);
  }
  return lista;
}

export class SqliteTransacaoRepository implements TransacaoRepository {
  constructor(private readonly obterBanco: () => Promise<SQLiteDatabase>) {}

  private async executar(
    sql: string,
    parametros: (string | number | null)[] = [],
  ): Promise<ResultSet> {
    const db = await this.obterBanco();
    const [resultado] = await db.executeSql(sql, parametros);
    return resultado;
  }

  async listarRecentes(limite: number): Promise<Transacao[]> {
    const resultado = await this.executar(
      `SELECT ${COLUNAS} FROM transacoes ORDER BY data DESC, id DESC LIMIT ?`,
      [limite],
    );
    return linhas<LinhaTransacao>(resultado).map(paraTransacao);
  }

  async listarPagina(
    limite: number,
    deslocamento: number,
  ): Promise<Transacao[]> {
    if (!Number.isInteger(limite) || limite <= 0) {
      throw new Error(`Limite inválido: ${limite}. Use um inteiro positivo.`);
    }
    if (!Number.isInteger(deslocamento) || deslocamento < 0) {
      throw new Error(
        `Deslocamento inválido: ${deslocamento}. Use um inteiro não negativo.`,
      );
    }
    const resultado = await this.executar(
      `SELECT ${COLUNAS} FROM transacoes ORDER BY data DESC, id DESC LIMIT ? OFFSET ?`,
      [limite, deslocamento],
    );
    return linhas<LinhaTransacao>(resultado).map(paraTransacao);
  }

  async buscarPorId(id: number): Promise<Transacao | null> {
    const resultado = await this.executar(
      `SELECT ${COLUNAS} FROM transacoes WHERE id = ?`,
      [id],
    );
    const [linha] = linhas<LinhaTransacao>(resultado);
    return linha ? paraTransacao(linha) : null;
  }

  async criar(dados: DadosTransacao): Promise<number> {
    const resultado = await this.executar(
      `INSERT INTO transacoes
        ${COLUNAS_INSERT}`,
      parametrosInsert(dados),
    );
    return resultado.insertId;
  }

  async lancarRecorrente(dados: DadosTransacao): Promise<boolean> {
    const resultado = await this.executar(
      `INSERT OR IGNORE INTO transacoes
        ${COLUNAS_INSERT}`,
      parametrosInsert(dados),
    );
    return resultado.rowsAffected > 0;
  }

  async atualizar(id: number, dados: DadosTransacao): Promise<void> {
    try {
      await this.executar(
        `UPDATE transacoes
          SET tipo = ?, descricao = ?, valor_centavos = ?, data = ?,
              categoria = ?, recorrencia = ?, comprovante_uri = ?,
              conta_recorrente_id = ?, sincronizado = 0
          WHERE id = ?`,
        [...parametrosInsert(dados), id],
      );
    } catch (erro) {
      // idx_transacoes_conta_data: mover um lançamento gerado para a data de outro.
      if (dados.contaRecorrenteId !== null && /UNIQUE/i.test(String(erro))) {
        throw new Error('Esta conta fixa já tem um lançamento nessa data.');
      }
      throw erro;
    }
  }

  async excluir(id: number): Promise<void> {
    await this.executar('DELETE FROM transacoes WHERE id = ?', [id]);
  }

  async saldoAte(dataISO: string): Promise<number> {
    if (!dataISOValida(dataISO)) {
      throw new Error(`Data inválida: ${dataISO}. Use AAAA-MM-DD.`);
    }
    const resultado = await this.executar(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor_centavos
          ELSE -valor_centavos END), 0) AS saldo
        FROM transacoes
        WHERE data <= ?`,
      [dataISO],
    );
    const [linha] = linhas<{saldo: number | string | null}>(resultado);
    return Number(linha?.saldo ?? 0);
  }

  async totaisPorMes(
    deAnoMes: string,
    ateAnoMes: string,
  ): Promise<TotaisMes[]> {
    validarAnoMes(deAnoMes);
    validarAnoMes(ateAnoMes);
    const resultado = await this.executar(
      `SELECT substr(data, 1, 7) AS ano_mes,
          SUM(CASE WHEN tipo = 'receita' THEN valor_centavos ELSE 0 END) AS receitas,
          SUM(CASE WHEN tipo = 'despesa' THEN valor_centavos ELSE 0 END) AS despesas
        FROM transacoes
        WHERE substr(data, 1, 7) BETWEEN ? AND ?
        GROUP BY ano_mes
        ORDER BY ano_mes`,
      [deAnoMes, ateAnoMes],
    );
    return linhas<LinhaTotaisMes>(resultado).map(linha => ({
      anoMes: String(linha.ano_mes),
      receitasCentavos: Number(linha.receitas ?? 0),
      despesasCentavos: Number(linha.despesas ?? 0),
    }));
  }

  async gastosPorCategoria(anoMes: string): Promise<Record<string, number>> {
    validarAnoMes(anoMes);
    const resultado = await this.executar(
      `SELECT categoria, SUM(valor_centavos) AS total
        FROM transacoes
        WHERE tipo = 'despesa' AND data BETWEEN ? AND ?
        GROUP BY categoria`,
      [`${anoMes}-01`, ultimoDiaDoMes(anoMes)],
    );
    const gastos: Record<string, number> = {};
    for (const linha of linhas<LinhaGastoCategoria>(resultado)) {
      gastos[linha.categoria] = Number(linha.total ?? 0);
    }
    return gastos;
  }

  async exemplosDeCategoria(limite = 500): Promise<ExemploCategoria[]> {
    const resultado = await this.executar(
      `SELECT descricao, categoria FROM transacoes
        WHERE tipo = 'despesa' AND categoria <> 'outros'
        ORDER BY data DESC, id DESC
        LIMIT ?`,
      [limite],
    );
    return linhas<ExemploCategoria>(resultado).map(
      ({descricao, categoria}) => ({
        descricao,
        categoria,
      }),
    );
  }

  async buscarCandidatasDuplicata(
    tipo: TipoTransacao,
    valorCentavos: number,
    data: string,
  ): Promise<CandidataDuplicata[]> {
    const resultado = await this.executar(
      `SELECT ${COLUNAS}, criado_em FROM transacoes
        WHERE tipo = ? AND valor_centavos = ? AND data = ?
        ORDER BY criado_em DESC LIMIT 10`,
      [tipo, valorCentavos, data],
    );
    return linhas<LinhaTransacao & {criado_em: string}>(resultado).map(
      linha => ({transacao: paraTransacao(linha), criadoEm: linha.criado_em}),
    );
  }
}
