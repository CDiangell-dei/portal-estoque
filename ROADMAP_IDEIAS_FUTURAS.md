# 📌 Backlog Estratégico & Roadmap de Ideias Futuras
### Portal de Controle de Estoques • Amazon Aço

> **Documento de Referência Contínua**: Este documento centraliza todas as especificações funcionais, regras de negócio e arquiteturas planejadas para implementação futura, conforme alinhamentos com a TI, diretoria e novos fluxos operacionais.

---

## 📑 Sumário de Iniciativas Futuras

| ID | Iniciativa / Módulo | Dependência Principal | Impacto Operacional | Status |
| :---: | :--- | :--- | :--- | :---: |
| **F01** | **Expedição & Entrega Fracionada Digital (SD2)** | Banco SD2 / Balcão | Fim do papel e controle de "retira posterior" | 💡 Planejado |
| **F02** | **Fila de Separação Antecipada (*Picking WMS*)** | Espelho do ERP via TI | Agilidade no carregamento e expedição | 💡 Planejado |
| **F03** | **Gestão de Pedidos Aguardando Retirada** | Integração Comercial | Liberação de espaço físico no galpão/doca | 💡 Planejado |
| **F04** | **Marco Zero & Data de Corte da Auditoria Geral** | Auditoria / Inventário | Fim do estoque fantasma de pedidos antigos | 💡 Planejado |
| **F05** | **Monitor de Cobertura de Estoque (6 Meses / 1 Ano)** | Consumo Médio (CMM) | Prevenção de compras excessivas de químicos/tintas | 💡 Planejado |

---

## 1. 📦 [F01] Expedição & Entrega Fracionada Digital (SD2)

### 🎯 Problema a Resolver
Quando um cliente compra materiais no comércio/atacado (ex: eletrodos, tintas, cantoneiras) e retira apenas parte da mercadoria no ato da compra, as lojas costumam anotar à caneta no canhoto da nota fiscal. Se o papel sumir ou se outro conferente atender o cliente dias depois, perde-se a rastreabilidade do que já foi entregue e do que ainda resta retirar.

### ⚙️ Especificação Técnica e Funcional
- **Busca Rápida**: Por Número da Nota/Minuta (`num_documento`) + Série, ou por CPF/CNPJ/Código do Cliente.
- **Cruzamento de Tabelas**:
  - `sd2_comercio`: Itens faturados, quantidades e valores.
  - `sb1_comercio`: Descrição completa dos produtos.
  - `entregas_minutas_itens` *(Nova tabela a criar)*: Histórico de entregas parciais.
- **Interface de Checklist de Saída**:
  - Exibição de: *Quantidade Faturada*, *Quantidade Já Entregue* e *Saldo Pendente a Retirar*.
  - Status visual: ⚪ *Pendente (0%)*, 🟡 *Parcial (Falta entregar itens)*, 🟢 *Concluído (100% Entregue)*.
- **Rastreabilidade**: Registro obrigatório de:
  - Conferente que realizou a entrega física.
  - Nome e documento (RG/CPF) de quem retirou no balcão.
  - Data e hora exata da entrega.
  - Emissão de comprovante digital (WhatsApp / PDF).

---

## 2. ⚡ [F02] Fila de Separação Antecipada (*Picking WMS*)

### 🎯 Problema a Resolver
Atualmente, a separação dos materiais só começa quando o caminhão ou cliente chega fisicamente na doca, gerando filas, atrasos no carregamento e estresse na expedição.

### ⚙️ Especificação Técnica e Funcional
- **Integração TI**: A TI da empresa configura um espelho / réplica / webhook que envia as notas faturadas no ERP Protheus para uma tabela de fila no Supabase.
- **Painel em Tempo Real no Almoxarifado**:
  - Assim que a nota é emitida no faturamento, ela aparece instantaneamente no monitor da expedição.
  - Os conferentes iniciam a separação, agrupamento e amarração dos materiais nas baias de saída antes da chegada do veículo.

---

## 3. ⏱️ [F03] Gestão de Pedidos Aguardando Retirada & Ocupação de Doca

### 🎯 Problema a Resolver
Materiais faturados que ficam ocupando espaço no chão de fábrica e no almoxarifado por semanas ou meses porque o cliente não veio buscar.

### ⚙️ Regras de Negócio e Alertas
- **0 a 30 dias**: Período normal de armazenagem pós-faturamento.
- **31 a 60 dias**: ⚠️ *Alerta Amarelo* — Sistema notifica a equipe de vendas para acionar o cliente.
- **> 60 dias**: 🚨 *Alerta Vermelho* — Cobrança de taxa de armazenagem ou encaminhamento para cancelamento/estorno fiscal.

---

## 4. ⚖️ [F04] Política de Data de Corte (*Cut-off*) da Auditoria Geral

### 🎯 Problema a Resolver
Pedidos muito antigos (ex: faturados há mais de 1 ano) continuam aparecendo como "pendentes de retirada", gerando "estoque fantasma" e distorcendo a acuracidade dos saldos.

### ⚙️ Regras de Negócio
- **Marco Zero da Auditoria**: Na data da realização do Inventário Geral Anual (quando os saldos físicos são ajustados no ERP), todos os pedidos pendentes com data anterior são automaticamente marcados como **"Encerrados por Auditoria"**.
- **Reincorporação de Mercadoria**: Se o material físico ainda estiver no galpão, a auditoria/fiscal estorna a reserva e o saldo volta a ficar 100% disponível para venda.

---

## 5. 🛡️ [F05] Monitor de Cobertura de Estoque (6 Meses / 1 Ano)

### 🎯 Problema a Resolver
Evitar novas compras de produtos químicos, tintas e eletrodos em quantidades que excedam a vida útil do produto (validade padrão de 1 ano), alinhando a empresa com a nova diretriz de **estoque máximo de 6 meses**.

### ⚙️ Indicador no Painel
$$\text{Meses de Cobertura} = \frac{\text{Saldo Físico Atual}}{\text{Consumo Médio Mensal (CMM)}}$$

- **Se Cobertura $\le$ 6 meses**: 🟢 Nível Saudável (Permite compra).
- **Se Cobertura > 6 meses**: 🟡 Estoque em Alerta (Bloqueio preventivo de compra).
- **Se Cobertura > 12 meses**: 🔴 Risco Crítico de Vencimento no Armazém 50.

---

### 📝 Histórico de Revisões deste Documento
- **v1.0 (2026-08-23)**: Criação inicial do backlog com as 5 iniciativas estratégicas aprovadas para futuras fases.
