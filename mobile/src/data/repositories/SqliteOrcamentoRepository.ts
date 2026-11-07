import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

import type {
  DadosOrcamento,
  NivelAlerta,
  Orcamento,
} from '../../domain/entities/Orcamento';
import type {OrcamentoRepository} from '../../domain/repositories/OrcamentoRepository';

interface LinhaOrcamento {
  id: number;
  categoria: string;
  limite_centavos: number;
}

function paraOrcamento(linha: LinhaOrcamento): Orcamento {
  return {
    id: linha.id,
    categoria: linha.categoria,
    limiteCentavos: Number(linha.limite_centavos),
  };
}

function linhas<T>(resultado: ResultSet): T[] {
  const lista: T[] = [];
  for (let i = 0; i < resultado.rows.length; i++) {
    lista.push(resultado.rows.item(i) as T);
  }
  return lista;
}

export class SqliteOrcamentoRepository implements OrcamentoRepository {
  constructor(private readonly obterBanco: () => Promise<SQLiteDatabase>) {}

  private async executar(
    sql: string,
    parametros: (string | number | null)[] = [],
  ): Promise<ResultSet> {
    const db = await this.obterBanco();
    const [resultado] = await db.executeSql(sql, parametros);
    return resultado;
  }

  async listar(): Promise<Orcamento[]> {
    const resultado = await this.executar(
      'SELECT id, categoria, limite_centavos FROM orcamentos ORDER BY id',
    );
    return linhas<LinhaOrcamento>(resultado).map(paraOrcamento);
  }

  // Sem ON CONFLICT DO UPDATE: o plugin usa o SQLite do sistema, e essa sintaxe
  // (3.24) só existe a partir do Android 11. O minSdk é 21.
  async salvar(dados: DadosOrcamento): Promise<void> {
    const db = await this.obterBanco();
    await db.transaction(tx => {
      tx.executeSql(
        'INSERT OR IGNORE INTO orcamentos (categoria, limite_centavos) VALUES (?, ?)',
        [dados.categoria, dados.limiteCentavos],
      );
      tx.executeSql(
        `UPDATE orcamentos
          SET limite_centavos = ?,
              atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE categoria = ?`,
        [dados.limiteCentavos, dados.categoria],
      );
    });
  }

  async excluir(id: number): Promise<void> {
    await this.executar('DELETE FROM orcamentos WHERE id = ?', [id]);
  }

  async registrarAlerta(
    categoria: string,
    anoMes: string,
    nivel: NivelAlerta,
  ): Promise<boolean> {
    const resultado = await this.executar(
      `INSERT OR IGNORE INTO alertas_orcamento (categoria, ano_mes, nivel)
        VALUES (?, ?, ?)`,
      [categoria, anoMes, nivel],
    );
    return resultado.rowsAffected > 0;
  }
}
