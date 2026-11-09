// Exportação da conta do Nubank (Data, Valor, Identificador, Descrição).
export const NUBANK_CONTA = `Data,Valor,Identificador,Descrição
03/11/2026,-89.90,6720f0c1-aaaa-4bbb-8ccc-000000000001,Compra no débito - Supermercado Bom Preço
05/11/2026,4250.00,6720f0c1-aaaa-4bbb-8ccc-000000000002,Transferência recebida - Empresa X
06/11/2026,-12.50,6720f0c1-aaaa-4bbb-8ccc-000000000003,"Pagamento de boleto - Luz, gás"
`;

// Fatura do cartão Nubank: compra positiva, pagamento negativo.
export const NUBANK_CARTAO = `date,title,amount
2026-11-02,Ifood *Restaurante,45.90
2026-11-03,Uber *Trip,18.20
2026-11-05,Pagamento recebido,-500.00
`;

// Banco genérico com ";" e vírgula decimal.
export const GENERICO_PONTO_E_VIRGULA = `Data Lançamento;Histórico;Valor (R$)
01/11/2026;SALARIO;4.250,00
02/11/2026;"PADARIA; CAFE DA MANHA";-12,50
02/11/2026;PIX ENVIADO "JOAO";-100,00
`;

export const COLUNAS_DESCONHECIDAS = `quando;o que;quanto
01/11/2026;Mercado;-10,00
02/11/2026;Farmácia;-25,00
`;

export const COM_LINHA_INVALIDA = `Data;Descrição;Valor
01/11/2026;Mercado;-10,00
31/02/2026;Data impossível;-5,00
02/11/2026;Valor estranho;abc
03/11/2026;Zerado;0,00
04/11/2026;Farmácia;-25,00
`;

export const LINHAS_IDENTICAS = `Data;Descrição;Valor
03/11/2026;Café;-5,00
03/11/2026;Café;-5,00
`;
