import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import type {Cofre} from '../src/domain/entities/Cofre';
import CofreCard from '../src/presentation/components/CofreCard';
import CofreMiniCard from '../src/presentation/components/CofreMiniCard';
import {darkTheme} from '../src/presentation/theme';
import {CORES} from '../src/presentation/theme/cores';

const cofre = (dados: Partial<Cofre> = {}): Cofre => ({
  id: 1,
  nome: 'Viagem',
  icone: '✈️',
  cor: '#64B5F6',
  metaCentavos: 960000,
  prazo: '2027-10',
  saldoCentavos: 0,
  ...dados,
});

describe('cards de cofre com prazo', () => {
  let tree: ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers({now: new Date(2026, 10, 7, 12)});
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function renderizar(elemento: React.JSX.Element) {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>{elemento}</PaperProvider>,
      );
    });
  }

  const renderizarCard = (dados?: Partial<Cofre>) =>
    renderizar(
      <CofreCard
        cofre={cofre(dados)}
        onPress={() => {}}
        onGuardar={() => {}}
        onRetirar={() => {}}
        onEditar={() => {}}
        onExcluir={() => {}}
      />,
    );

  const hospedeiro = (id: string) =>
    tree.root.findAll(
      no => typeof no.type === 'string' && no.props.testID === id,
    );

  function textoDe(no: ReactTestInstance): string {
    return no.children
      .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
      .join('');
  }

  const rotulo = (id: string) =>
    tree.root.findAll(
      no => no.props.testID === id && no.props.accessibilityLabel,
    )[0].props.accessibilityLabel;

  const corDe = (no: ReactTestInstance) =>
    Object.assign({}, ...[no.props.style].flat(Infinity)).color;

  it('em andamento mostra o valor por mês', async () => {
    await renderizarCard();

    const [plano] = hospedeiro('cofre-plano-1');
    expect(textoDe(plano)).toBe('R$ 800,00/mês · até out. 2027');
    expect(corDe(plano)).toBe(CORES.textoSecundario);
    expect(rotulo('cofre-card-1')).toBe(
      'Cofre Viagem: R$ 0,00 guardados. R$ 800,00/mês · até out. 2027',
    );
  });

  it('em curto prazo mostra o valor por dia', async () => {
    await renderizarCard({metaCentavos: 12000, prazo: '2026-11'});
    expect(textoDe(hospedeiro('cofre-plano-1')[0])).toBe(
      'R$ 5,00/dia · até 30 de nov.',
    );
  });

  it('concluída mostra "Meta atingida" em verde', async () => {
    await renderizarCard({saldoCentavos: 960000});

    const [plano] = hospedeiro('cofre-plano-1');
    expect(textoDe(plano)).toBe('Meta atingida 🎉');
    expect(corDe(plano)).toBe(CORES.verde);
    expect(rotulo('cofre-card-1')).toContain('Meta atingida 🎉');
  });

  it('vencida mostra quanto falta em vermelho', async () => {
    await renderizarCard({
      metaCentavos: 100000,
      saldoCentavos: 30000,
      prazo: '2026-10',
    });

    const [plano] = hospedeiro('cofre-plano-1');
    expect(textoDe(plano)).toBe('Prazo encerrado · faltam R$ 700,00');
    expect(corDe(plano)).toBe(CORES.vermelho);
  });

  it('sem prazo não mostra a linha do plano', async () => {
    await renderizarCard({prazo: null});

    expect(hospedeiro('cofre-plano-1')).toHaveLength(0);
    expect(rotulo('cofre-card-1')).toBe('Cofre Viagem: R$ 0,00 guardados');
  });

  it('o mini card mostra a parcela só em andamento', async () => {
    await renderizar(<CofreMiniCard cofre={cofre()} onPress={() => {}} />);
    expect(textoDe(hospedeiro('cofre-mini-parcela-1')[0])).toBe(
      'R$ 800,00/mês',
    );

    await act(async () => {
      tree.update(
        <PaperProvider theme={darkTheme}>
          <CofreMiniCard
            cofre={cofre({metaCentavos: 12000, prazo: '2026-11'})}
            onPress={() => {}}
          />
        </PaperProvider>,
      );
    });
    expect(textoDe(hospedeiro('cofre-mini-parcela-1')[0])).toBe('R$ 5,00/dia');

    await act(async () => {
      tree.update(
        <PaperProvider theme={darkTheme}>
          <CofreMiniCard
            cofre={cofre({saldoCentavos: 960000})}
            onPress={() => {}}
          />
        </PaperProvider>,
      );
    });
    expect(hospedeiro('cofre-mini-parcela-1')).toHaveLength(0);
  });
});
