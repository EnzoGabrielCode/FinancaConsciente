import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

import {dataISOValida} from '../../domain/datas';
import type {TotaisMes} from '../../domain/entities/Dashboard';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';

interface LinhaTransacao {
  id: number;
  tipo: Transacao['tipo'];
  descricao: string;
  valor_centavos: number;
  data: string;
  categoria: string;
  recorrencia: Transacao['recorrencia'];
  comprovante_uri: string | null;
  sincronizado: number;
}

const COLUNAS =
  'id, tipo, descricao, valor_centavos, data, categoria, recorrencia, comprovante_uri, sincronizado';

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
    sincronizado: linha.sincronizado === 1,
  };
}

interface LinhaTotaisMes {
  ano_mes: string;
  receitas: number | string | null;
  despesas: number | string | null;
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
        (tipo, descricao, valor_centavos, data, categoria, recorrencia,
         comprovante_uri, sincronizado)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        dados.tipo,
        dados.descricao,
        dados.valorCentavos,
        dados.data,
        dados.categoria,
        dados.recorrencia,
        dados.comprovanteUri,
      ],
    );
    return resultado.insertId;
  }

  async atualizar(id: number, dados: DadosTransacao): Promise<void> {
    await this.executar(
      `UPDATE transacoes
        SET tipo = ?, descricao = ?, valor_centavos = ?, data = ?,
            categoria = ?, recorrencia = ?, comprovante_uri = ?,
            sincronizado = 0
        WHERE id = ?`,
      [
        dados.tipo,
        dados.descricao,
        dados.valorCentavos,
        dados.data,
        dados.categoria,
        dados.recorrencia,
        dados.comprovanteUri,
        id,
      ],
    );
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
}
