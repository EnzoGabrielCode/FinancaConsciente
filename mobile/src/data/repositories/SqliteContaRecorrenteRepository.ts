import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../../domain/entities/ContaRecorrente';
import type {ContaRecorrenteRepository} from '../../domain/repositories/ContaRecorrenteRepository';

interface LinhaConta {
  id: number;
  descricao: string;
  valor_centavos: number;
  categoria: string;
  frequencia: ContaRecorrente['frequencia'];
  dia: number;
  mes: number | null;
  lembrar_dias_antes: number;
  ativa: number;
  proxima: string;
}

const COLUNAS =
  'id, descricao, valor_centavos, categoria, frequencia, dia, mes, lembrar_dias_antes, ativa, proxima';

function paraConta(linha: LinhaConta): ContaRecorrente {
  return {
    id: linha.id,
    descricao: linha.descricao,
    valorCentavos: Number(linha.valor_centavos),
    categoria: linha.categoria,
    frequencia: linha.frequencia,
    dia: linha.dia,
    mes: linha.mes ?? null,
    lembrarDiasAntes: linha.lembrar_dias_antes,
    ativa: linha.ativa === 1,
    proxima: linha.proxima,
  };
}

function linhas<T>(resultado: ResultSet): T[] {
  const lista: T[] = [];
  for (let i = 0; i < resultado.rows.length; i++) {
    lista.push(resultado.rows.item(i) as T);
  }
  return lista;
}

export class SqliteContaRecorrenteRepository
  implements ContaRecorrenteRepository
{
  constructor(private readonly obterBanco: () => Promise<SQLiteDatabase>) {}

  private async executar(
    sql: string,
    parametros: (string | number | null)[] = [],
  ): Promise<ResultSet> {
    const db = await this.obterBanco();
    const [resultado] = await db.executeSql(sql, parametros);
    return resultado;
  }

  async listar(): Promise<ContaRecorrente[]> {
    const resultado = await this.executar(
      `SELECT ${COLUNAS} FROM contas_recorrentes ORDER BY proxima, id`,
    );
    return linhas<LinhaConta>(resultado).map(paraConta);
  }

  async buscarPorId(id: number): Promise<ContaRecorrente | null> {
    const resultado = await this.executar(
      `SELECT ${COLUNAS} FROM contas_recorrentes WHERE id = ?`,
      [id],
    );
    const [linha] = linhas<LinhaConta>(resultado);
    return linha ? paraConta(linha) : null;
  }

  async criar(dados: DadosContaRecorrente, proxima: string): Promise<number> {
    const resultado = await this.executar(
      `INSERT INTO contas_recorrentes
        (descricao, valor_centavos, categoria, frequencia, dia, mes,
         lembrar_dias_antes, ativa, proxima)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.descricao,
        dados.valorCentavos,
        dados.categoria,
        dados.frequencia,
        dados.dia,
        dados.mes,
        dados.lembrarDiasAntes,
        dados.ativa ? 1 : 0,
        proxima,
      ],
    );
    return resultado.insertId;
  }

  async atualizar(
    id: number,
    dados: DadosContaRecorrente,
    proxima: string,
  ): Promise<void> {
    await this.executar(
      `UPDATE contas_recorrentes
        SET descricao = ?, valor_centavos = ?, categoria = ?, frequencia = ?,
            dia = ?, mes = ?, lembrar_dias_antes = ?, ativa = ?, proxima = ?
        WHERE id = ?`,
      [
        dados.descricao,
        dados.valorCentavos,
        dados.categoria,
        dados.frequencia,
        dados.dia,
        dados.mes,
        dados.lembrarDiasAntes,
        dados.ativa ? 1 : 0,
        proxima,
        id,
      ],
    );
  }

  async excluir(id: number): Promise<void> {
    await this.executar('DELETE FROM contas_recorrentes WHERE id = ?', [id]);
  }

  async definirAtiva(id: number, ativa: boolean): Promise<void> {
    await this.executar(
      'UPDATE contas_recorrentes SET ativa = ? WHERE id = ?',
      [ativa ? 1 : 0, id],
    );
  }

  async avancarProxima(id: number, proxima: string): Promise<void> {
    await this.executar(
      'UPDATE contas_recorrentes SET proxima = ? WHERE id = ?',
      [proxima, id],
    );
  }
}
