import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

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

  async totalReceitasDoMes(anoMes: string): Promise<number> {
    if (!/^\d{4}-\d{2}$/.test(anoMes)) {
      throw new Error(`Mês inválido: ${anoMes}. Use AAAA-MM.`);
    }
    const resultado = await this.executar(
      `SELECT COALESCE(SUM(valor_centavos), 0) AS total
        FROM transacoes
        WHERE tipo = ? AND data BETWEEN ? AND ?`,
      ['receita', `${anoMes}-01`, `${anoMes}-31`],
    );
    return resultado.rows.length > 0 ? Number(resultado.rows.item(0).total) : 0;
  }
}
