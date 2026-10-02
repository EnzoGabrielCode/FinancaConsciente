import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {LancamentosComComprovante} from '../../domain/casosDeUso/LancamentosComComprovante';
import {hojeISO} from '../../domain/datas';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../../domain/repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export const LIMITE_RECENTES = 20;

export interface EstadoTransacoes {
  transacoes: Transacao[];
  totalReceitasMes: number;
  carregando: boolean;
  erro: string | null;
}

export interface UseTransacoes extends EstadoTransacoes {
  recarregar: () => Promise<void>;
  criar: (dados: DadosTransacao) => Promise<void>;
  atualizar: (id: number, dados: DadosTransacao) => Promise<void>;
  excluir: (id: number) => Promise<void>;
}

export function useTransacoes(
  repositorio: TransacaoRepository,
  armazenamento: ArmazenamentoComprovantes,
): UseTransacoes {
  const lancamentos = useMemo(
    () => new LancamentosComComprovante(repositorio, armazenamento),
    [repositorio, armazenamento],
  );
  const [estado, setEstado] = useState<EstadoTransacoes>({
    transacoes: [],
    totalReceitasMes: 0,
    carregando: true,
    erro: null,
  });
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const [transacoes, totalReceitasMes] = await Promise.all([
        repositorio.listarRecentes(LIMITE_RECENTES),
        repositorio.totalReceitasDoMes(hojeISO().slice(0, 7)),
      ]);
      if (montado.current) {
        setEstado({
          transacoes,
          totalReceitasMes,
          carregando: false,
          erro: null,
        });
      }
    } catch (erro) {
      if (montado.current) {
        setEstado(atual => ({
          ...atual,
          carregando: false,
          erro: mensagemDeErro(erro),
        }));
      }
    }
  }, [repositorio]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const criar = useCallback(
    async (dados: DadosTransacao) => {
      await lancamentos.criar(dados);
      await recarregar();
    },
    [lancamentos, recarregar],
  );

  const atualizar = useCallback(
    async (id: number, dados: DadosTransacao) => {
      await lancamentos.atualizar(id, dados);
      await recarregar();
    },
    [lancamentos, recarregar],
  );

  const excluir = useCallback(
    async (id: number) => {
      await lancamentos.excluir(id);
      await recarregar();
    },
    [lancamentos, recarregar],
  );

  return {...estado, recarregar, criar, atualizar, excluir};
}
