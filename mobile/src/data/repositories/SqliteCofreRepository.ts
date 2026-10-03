import type {ResultSet, SQLiteDatabase} from 'react-native-sqlite-storage';

import type {
  Cofre,
  DadosCofre,
  DadosMovimento,
  MovimentoCofre,
} from '../../domain/entities/Cofre';
import type {CofreRepository} from '../../domain/repositories/CofreRepository';

interface LinhaCofre {
  id: number;
  nome: string;
  icone: string;
  cor: string;
  meta_centavos: number | null;
  saldo: number | string | null;
}

interface LinhaMovimento {
  id: number;
  cofre_id: number;
  tipo: MovimentoCofre['tipo'];
  valor_centavos: number;
  data: string;
}

const SOMA_SALDO = `COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor_centavos
    ELSE -m.valor_centavos END), 0)`;

const SELECT_COFRES = `SELECT c.id, c.nome, c.icone, c.cor, c.meta_centavos,
    ${SOMA_SALDO} AS saldo
  FROM cofres c
  LEFT JOIN movimentos_cofre m ON m.cofre_id = c.id`;

function paraCofre(linha: LinhaCofre): Cofre {
  return {
    id: linha.id,
    nome: linha.nome,
    icone: linha.icone,
    cor: linha.cor,
    metaCentavos:
      linha.meta_centavos === null || linha.meta_centavos === undefined
        ? null
        : Number(linha.meta_centavos),
    saldoCentavos: Number(linha.saldo ?? 0),
  };
}

function paraMovimento(linha: LinhaMovimento): MovimentoCofre {
  return {
    id: linha.id,
    cofreId: linha.cofre_id,
    tipo: linha.tipo,
    valorCentavos: Number(linha.valor_centavos),
    data: linha.data,
  };
}

function linhas<T>(resultado: ResultSet): T[] {
  const lista: T[] = [];
  for (let i = 0; i < resultado.rows.length; i++) {
    lista.push(resultado.rows.item(i) as T);
  }
  return lista;
}

export class SqliteCofreRepository implements CofreRepository {
  constructor(private readonly obterBanco: () => Promise<SQLiteDatabase>) {}

  private async executar(
    sql: string,
    parametros: (string | number | null)[] = [],
  ): Promise<ResultSet> {
    const db = await this.obterBanco();
    const [resultado] = await db.executeSql(sql, parametros);
    return resultado;
  }

  async listar(): Promise<Cofre[]> {
    const resultado = await this.executar(
      `${SELECT_COFRES}
        GROUP BY c.id
        ORDER BY c.criado_em, c.id`,
    );
    return linhas<LinhaCofre>(resultado).map(paraCofre);
  }

  async buscarPorId(id: number): Promise<Cofre | null> {
    const resultado = await this.executar(
      `${SELECT_COFRES}
        WHERE c.id = ?
        GROUP BY c.id`,
      [id],
    );
    const [linha] = linhas<LinhaCofre>(resultado);
    return linha ? paraCofre(linha) : null;
  }

  async criar(dados: DadosCofre): Promise<number> {
    const resultado = await this.executar(
      `INSERT INTO cofres (nome, icone, cor, meta_centavos, sincronizado)
        VALUES (?, ?, ?, ?, 0)`,
      [dados.nome, dados.icone, dados.cor, dados.metaCentavos],
    );
    return resultado.insertId;
  }

  async atualizar(id: number, dados: DadosCofre): Promise<void> {
    await this.executar(
      `UPDATE cofres
        SET nome = ?, icone = ?, cor = ?, meta_centavos = ?, sincronizado = 0
        WHERE id = ?`,
      [dados.nome, dados.icone, dados.cor, dados.metaCentavos, id],
    );
  }

  async excluir(id: number): Promise<void> {
    const db = await this.obterBanco();
    await db.transaction(tx => {
      tx.executeSql('DELETE FROM movimentos_cofre WHERE cofre_id = ?', [id]);
      tx.executeSql('DELETE FROM cofres WHERE id = ?', [id]);
    });
  }

  async registrarMovimento(movimento: DadosMovimento): Promise<number> {
    const resultado = await this.executar(
      `INSERT INTO movimentos_cofre
        (cofre_id, tipo, valor_centavos, data, sincronizado)
        VALUES (?, ?, ?, ?, 0)`,
      [
        movimento.cofreId,
        movimento.tipo,
        movimento.valorCentavos,
        movimento.data,
      ],
    );
    return resultado.insertId;
  }

  async listarMovimentos(
    cofreId: number,
    limite: number,
  ): Promise<MovimentoCofre[]> {
    const resultado = await this.executar(
      `SELECT id, cofre_id, tipo, valor_centavos, data
        FROM movimentos_cofre
        WHERE cofre_id = ?
        ORDER BY data DESC, id DESC
        LIMIT ?`,
      [cofreId, limite],
    );
    return linhas<LinhaMovimento>(resultado).map(paraMovimento);
  }

  async totalGuardado(): Promise<number> {
    const resultado = await this.executar(
      `SELECT ${SOMA_SALDO} AS total FROM movimentos_cofre m`,
    );
    const [linha] = linhas<{total: number | string | null}>(resultado);
    return Number(linha?.total ?? 0);
  }
}
