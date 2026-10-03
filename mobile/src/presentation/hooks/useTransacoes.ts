import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {LancamentosComComprovante} from '../../domain/casosDeUso/LancamentosComComprovante';
import {MESES_GRAFICO, montarDashboard} from '../../domain/dashboard';
import {
  anoMesDe,
  hojeISO,
  mesesAte,
  ultimoDiaDoMesAnterior,
} from '../../domain/datas';
import type {ResumoDashboard} from '../../domain/entities/Dashboard';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../../domain/repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export const LIMITE_RECENTES = 20;

export interface EstadoTransacoes {
  transacoes: Transacao[];
  resumo: ResumoDashboard | null;
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
    resumo: null,
    carregando: true,
    erro: null,
  });
  const montado = useRef(true);
  const ultimaCarga = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const recarregar = useCallback(async () => {
    const carga = ++ultimaCarga.current;
    const ehAMaisRecente = () =>
      montado.current && carga === ultimaCarga.current;
    const hoje = hojeISO();
    const anoMesAtual = anoMesDe(hoje);
    const [primeiroMes] = mesesAte(anoMesAtual, MESES_GRAFICO);
    try {
      const [
        transacoes,
        saldoAtualCentavos,
        saldoFimMesAnteriorCentavos,
        totaisPorMes,
      ] = await Promise.all([
        repositorio.listarRecentes(LIMITE_RECENTES),
        repositorio.saldoAte(hoje),
        repositorio.saldoAte(ultimoDiaDoMesAnterior(anoMesAtual)),
        repositorio.totaisPorMes(primeiroMes, anoMesAtual),
      ]);
      if (ehAMaisRecente()) {
        setEstado({
          transacoes,
          resumo: montarDashboard({
            saldoAtualCentavos,
            saldoFimMesAnteriorCentavos,
            totaisPorMes,
            anoMesAtual,
          }),
          carregando: false,
          erro: null,
        });
      }
    } catch (erro) {
      if (ehAMaisRecente()) {
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

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', estadoApp => {
      if (estadoApp === 'active') {
        recarregar();
      }
    });
    return () => assinatura.remove();
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
