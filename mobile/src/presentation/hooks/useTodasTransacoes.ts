import {useCallback, useEffect, useRef, useState} from 'react';

import type {Transacao} from '../../domain/entities/Transacao';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export const TAMANHO_PAGINA = 30;

export interface EstadoTodasTransacoes {
  transacoes: Transacao[];
  carregando: boolean;
  carregandoMais: boolean;
  erro: string | null;
  fim: boolean;
}

export interface UseTodasTransacoes extends EstadoTodasTransacoes {
  recarregar: () => Promise<void>;
  carregarMais: () => Promise<void>;
}

// Com ativo = false nada é consultado; ao virar true a primeira página é
// recarregada, o que mantém a lista em dia a cada abertura da tela.
export function useTodasTransacoes(
  repositorio: TransacaoRepository,
  ativo: boolean = true,
): UseTodasTransacoes {
  const [estado, setEstado] = useState<EstadoTodasTransacoes>({
    transacoes: [],
    carregando: true,
    carregandoMais: false,
    erro: null,
    fim: false,
  });
  const montado = useRef(true);
  const ultimaCarga = useRef(0);
  // Refs e não estado: duas chamadas seguidas enxergariam o mesmo estado antigo.
  const ocupado = useRef(false);
  const chegouAoFim = useRef(false);
  const deslocamento = useRef(0);

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
    ocupado.current = true;
    setEstado(atual => ({
      ...atual,
      carregando: true,
      carregandoMais: false,
      erro: null,
    }));
    try {
      const pagina = await repositorio.listarPagina(TAMANHO_PAGINA, 0);
      if (ehAMaisRecente()) {
        deslocamento.current = pagina.length;
        chegouAoFim.current = pagina.length < TAMANHO_PAGINA;
        ocupado.current = false;
        setEstado({
          transacoes: pagina,
          carregando: false,
          carregandoMais: false,
          erro: null,
          fim: chegouAoFim.current,
        });
      }
    } catch (erro) {
      if (ehAMaisRecente()) {
        // A lista antiga é descartada: manter mostraria itens já excluídos.
        deslocamento.current = 0;
        chegouAoFim.current = false;
        ocupado.current = false;
        setEstado({
          transacoes: [],
          carregando: false,
          carregandoMais: false,
          erro: mensagemDeErro(erro),
          fim: false,
        });
      }
    }
  }, [repositorio]);

  const carregarMais = useCallback(async () => {
    if (ocupado.current || chegouAoFim.current) {
      return;
    }
    const carga = ultimaCarga.current;
    const ehAMaisRecente = () =>
      montado.current && carga === ultimaCarga.current;
    ocupado.current = true;
    setEstado(atual => ({...atual, carregandoMais: true, erro: null}));
    try {
      const pagina = await repositorio.listarPagina(
        TAMANHO_PAGINA,
        deslocamento.current,
      );
      if (ehAMaisRecente()) {
        deslocamento.current += pagina.length;
        chegouAoFim.current = pagina.length < TAMANHO_PAGINA;
        ocupado.current = false;
        setEstado(atual => {
          // Um lançamento novo empurra os demais e repete um item entre páginas.
          const ids = new Set(atual.transacoes.map(t => t.id));
          return {
            ...atual,
            transacoes: [
              ...atual.transacoes,
              ...pagina.filter(t => !ids.has(t.id)),
            ],
            carregandoMais: false,
            fim: chegouAoFim.current,
          };
        });
      }
    } catch (erro) {
      if (ehAMaisRecente()) {
        ocupado.current = false;
        setEstado(atual => ({
          ...atual,
          carregandoMais: false,
          erro: mensagemDeErro(erro),
        }));
      }
    }
  }, [repositorio]);

  useEffect(() => {
    if (ativo) {
      recarregar();
    }
  }, [ativo, recarregar]);

  return {...estado, recarregar, carregarMais};
}
