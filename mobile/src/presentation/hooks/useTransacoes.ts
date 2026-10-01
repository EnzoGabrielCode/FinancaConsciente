import {useCallback, useEffect, useRef, useState} from 'react';

import {hojeISO} from '../../domain/datas';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
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

export function useTransacoes(repositorio: TransacaoRepository): UseTransacoes {
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
      await repositorio.criar(dados);
      await recarregar();
    },
    [repositorio, recarregar],
  );

  const atualizar = useCallback(
    async (id: number, dados: DadosTransacao) => {
      await repositorio.atualizar(id, dados);
      await recarregar();
    },
    [repositorio, recarregar],
  );

  const excluir = useCallback(
    async (id: number) => {
      await repositorio.excluir(id);
      await recarregar();
    },
    [repositorio, recarregar],
  );

  return {...estado, recarregar, criar, atualizar, excluir};
}
