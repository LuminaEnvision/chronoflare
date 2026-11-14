# ChronoFlare — Blueprint final de produto, ciência e implementação

**Versão consolidada:** 1.2 · **Data:** 14 de novembro de 2026 · **Evento:** NASA Space Apps Challenge 2026 (14–15 de novembro)

> **Understanding fire activity through time.**

**Natureza do documento.** Este é o blueprint operacional único da equipe. Incorpora o texto das seções revisadas v1.1/v1.1.1 (4.3, 7.3, 11, 14 e 17), com as correções editoriais acordadas. As demais seções foram reconstruídas em linguagem de execução a partir das decisões disponíveis, pois o texto integral da v1.0 não está entre os arquivos acessíveis nesta consolidação. Os detalhes acrescentados são assinalados como **proposta de implementação**, e não como decisões científicas já validadas.

**Status científico:** decisão de estratégia fechada; aprovação empírica da calibração, limites quantitativos e qualidade dos dados ainda dependem de André. **Status do MVP:** iniciar desenvolvimento sem aguardar a análise científica, com dados fictícios no contrato real.

## Resumo executivo

ChronoFlare é uma aplicação web para explorar **atividade de queima detectada por satélites ao longo do tempo**, com ênfase na comparabilidade entre registros MODIS e VIIRS. O núcleo do produto é um calendário histórico ano × dia do ano que revela sazonalidade, períodos incomuns, origem das observações e incerteza. Mapa simples e página de Metodologia complementam o calendário.

O projeto **não detecta incêndios em tempo real**, **não confirma ocorrências de incêndio** e **não prevê risco**. O trabalho científico central é testar se uma transformação MODIS→escala VIIRS pode ser defendida na sobreposição de sensores; se não puder, o produto mostrará séries separadas e a limitação como parte do resultado. Antes de 2012, qualquer estimativa em escala VIIRS é extrapolação e não tem validação direta contra VIIRS.

O MVP utiliza **artefatos estáticos pré-computados**, interface estática e **um único deploy**. Não depende de API Python em produção, banco PostGIS ou backend persistente durante o hackathon. A região piloto proposta é o **Pantanal brasileiro**, sujeita à confirmação da área de interesse (AOI), disponibilidade e cobertura dos dados.

### Compromissos inegociáveis

- Ciência rastreável; não chamar dado estimado de observado, nem série reprovada de harmonizada.
- Sem dados ≠ zero; coberturas insuficientes não viram zeros artificiais.
- Frontend, ciência e apresentação acontecem em paralelo.
- O checkpoint científico encerra em uma decisão **plano A/plano B**, e não em uma tentativa ilimitada de otimização.
- Entrega final é uma demo reproduzível, compreensível e transparente, não uma promessa de reconstrução perfeita.

---

## 1. Problema, oportunidade e objetivo

### 1.1. Problema

MODIS e VIIRS observam anomalias térmicas com características instrumentais, resoluções, horários de passagem e critérios de confiança diferentes. A simples concatenação de contagens ou FRP por ano pode criar mudanças artificiais que parecem mudanças no fogo observado, especialmente quando sensores e plataformas entram na série. O usuário também pode confundir ausência de registros com ausência de fogo.

### 1.2. Oportunidade

Permitir que pesquisadores, comunicadores, analistas ambientais e usuários não especialistas investiguem **quando** a atividade detectada tende a ocorrer e **como** a série muda entre anos, entendendo as limitações da observação orbital. Uma interface visual única traduz metodologia e incerteza sem ocultá-las.

### 1.3. Objetivo do MVP

Produzir uma exploração histórica que responda: **“Qual é o padrão sazonal da região, quais anos/períodos se afastam dele e quanto podemos confiar na comparação temporal?”** A resposta deve permanecer útil mesmo se a harmonização falhar.

### 1.4. Não objetivos

Não desenvolver previsão, alerta emergencial, propagação de incêndios, área queimada, atribuição causal, fusão de eventos individuais, estimativa de emissões, mapa global sob demanda nem painel operacional em tempo real. Esses temas podem ser estudos futuros, não compromissos do MVP.

## 2. Posicionamento e identidade

### 2.1. Nome e mensagem

**ChronoFlare** — *Understanding fire activity through time.*

Mensagem de produto: *Explore a história da atividade de queima detectada por satélites, com comparações mais transparentes entre sensores e incerteza visível.*

### 2.2. Linguagem e compromisso editorial

Usar termos como **“focos térmicos”**, **“detecções”**, **“atividade detectada”**, **“índice relativo de atividade”**, **“observado”**, **“estimado”**, **“extrapolado”** e **“cobertura insuficiente”**. Evitar rótulos como “número de incêndios”, “verdade histórica” ou “energia total do fogo”. Todas as métricas de comparação devem indicar escala, sensor e status metodológico.

### 2.3. Diretrizes visuais (proposta operacional)

- Interface limpa, orientada a dados, com leitura fácil em desktop e celular.
- A paleta de **intensidade** usa progressão perceptualmente uniforme do nível baixo até laranja/vermelho. **Não utilizar o mesmo laranja para identificar MODIS**; a cor de identidade proposta para MODIS é violeta, enquanto VIIRS recebe cor independente.
- Estados categóricos (observado, estimado, ausência, zero adequado, incomum) distinguem-se também por **padrão, contorno ou texto**, nunca apenas por tonalidade.
- A legenda dos estados fica junto ao calendário e acessível por teclado. A intensidade não comunica confiança; estimativa e intervalo de incerteza são camadas separadas.

## 3. Público, jornadas e navegação

### 3.1. Perfis prioritários

1. Pesquisador/analista: precisa rastrear metodologia, versões, cobertura e comparação MODIS–VIIRS.
2. Jornalista/educador: precisa identificar sazonalidade e explicar anos incomuns sem afirmar causalidade.
3. Público interessado: precisa de uma visão clara, sem exigir familiaridade com processamento remoto.

### 3.2. Navegação P0

**Calendário · Mapa · Metodologia**. A tela inicial é o Calendário. Informações tipo “Overview” e “Analysis” aparecem em seus cartões e painel de detalhes, sem criar rotas extras. A navegação preserva AOI, ano e período selecionados quando o usuário alterna entre calendário e mapa.

### 3.3. Jornada demonstrável

O usuário abre a região piloto, identifica a janela típica da temporada, clica em um período atípico, lê valor/base/incerteza e percentil, abre o mapa filtrado, volta ao calendário e confere no texto da Metodologia como aquela conclusão foi produzida. O fluxo funciona tanto no plano A quanto no plano B.

## 4. Especificação de telas e experiência

### 4.1. Calendário — cabeçalho e indicadores

P0: nome da região; intervalo de observação efetivamente disponível; seletor de base (**Harmonizado aprovado**, **MODIS original**, **VIIRS original**); legenda de status; painel com indicador relativo, janela típica da temporada e status da validação. No plano B, a opção “Harmonizado aprovado” fica **indisponível**, com motivo explícito, nunca aparece como série válida.

Os KPIs privilegiam o **índice harmonizado de FRP** apenas se a calibração tiver passado; fora disso, mostrar métricas originais por sensor e aviso de incomparabilidade. Contagem de detecções não deve figurar como número de incêndios.

### 4.2. Estrutura e interação geral

Layout P0: barra de contexto da AOI; calendário principal; legenda persistente; painel de detalhes com referência, incerteza e proveniência; links para Mapa e Metodologia. Estados de carregamento, ausência de arquivo, falha de rede e dados insuficientes precisam de texto compreensível. Controles desabilitados indicam por quê.

---

## 4.3. Burning Activity Calendar — Módulo principal

**Objetivo:** mostrar, em uma única visualização, quando a atividade de queima costuma ocorrer na região, quais anos e períodos foram incomuns e quão confiável é cada valor.

Este é o principal diferencial do ChronoFlare.

### Layout

**Cabeçalho**

- Região e período histórico.
- Métrica (padrão: índice harmonizado **apenas se aprovado na validação**; caso contrário, exibir a base original do sensor selecionado).
- Base dos dados: Harmonizado, MODIS original ou VIIRS original.
- Resolução de exibição: dia (série original), com média móvel de 7 dias como opção visual; semana ou mês como agregações exploratórias.

**Visualização principal**

- Heatmap com anos no eixo vertical e dia do ano no eixo horizontal (marcações de mês).
- Escala de cor sequencial perceptualmente uniforme, sem usar a cor de identidade do MODIS (ver seção 2.3).
- Faixa superior com a janela crítica típica (início, pico e fim do ano mediano).
- Contorno nos períodos incomuns.

### Estados visuais obrigatórios

| Estado | Representação | Significado |
| --- | --- | --- |
| Observado (VIIRS) | Cor sólida | Valor medido |
| Estimado a partir do MODIS | Cor com hachura | VIIRS equivalente estimado; tooltip com faixa de incerteza e, antes de 2012, o rótulo de extrapolação sem validação direta |
| Sem dados ou cobertura insuficiente | Cinza neutro com padrão próprio | Ausência de dado, não zero |
| Zero com cobertura adequada | Cor mais baixa da escala | Nenhuma detecção |
| Período incomum | Contorno vermelho | Acima do P90 da referência por pelo menos 3 dias seguidos, na série diária |

A legenda dos cinco estados fica sempre visível.

### Métricas

- **Padrão:** índice harmonizado (soma de FRP em escala VIIRS equivalente por AOI-dia), sujeito à validação da seção 11.
- **Alternativas:** contagem de detecções (com aviso de que depende da resolução do sensor) e número de dias com atividade.

### Interações

- Selecionar um ano ou um período (dia ou semana).
- Comparar dois anos lado a lado, ou um ano contra a referência histórica.
- Alternar a base dos dados.
- Abrir o mapa já filtrado no período selecionado.
- Exportar PNG e CSV (P1).

### Painel de detalhes

Ao selecionar um ano ou período:

- Valor e base (observado ou estimado).
- Faixa de incerteza.
- Referência histórica: mediana e P10–P90, calculadas sem o próprio ano.
- Percentil e z robusto.
- Número de observações e cobertura por sensor.
- Série diária do período.
- Se foi declarado incomum: método e referência utilizados.

### Modo ‘Por que harmonizar?’

Compara três séries da mesma AOI: MODIS puro, emenda ingênua (MODIS até 2011 e VIIRS depois) e série harmonizada. Gráfico na página de Metodologia (P0) e alternância no calendário (P1). Se o salto de 2012 não aparecer nos dados reais, documentar isso com honestidade e ajustar a narrativa do pitch. No plano B (11.7), o gráfico mostra MODIS e VIIRS separados e a comparação na sobreposição.

### Requisitos científicos

- Ausência de dado nunca é exibida como zero.
- Anos estimados nunca aparecem como observados. Estimativas anteriores à sobreposição MODIS–VIIRS (antes de 2012) são extrapolações da relação calibrada e não têm validação direta contra o VIIRS; isso consta na legenda, no tooltip e na Metodologia.
- Toda cor do calendário pode ser traduzida em valor, base e incerteza pelo painel de detalhes.
- O calendário descreve atividade detectada por satélite. Não é previsão nem confirmação de incêndio.

### Critério de conclusão

Um usuário novo entende em cerca de 10 segundos quando é a temporada e consegue dizer qual ano foi incomum e por quê.

---

## 4.4. Mapa — contexto espacial

**Objetivo:** visualizar a distribuição espacial agregada da atividade para o ano ou período escolhido no calendário; **não** reconstruir limites de incêndios. P0 usa camada pré-computada por célula H3 com legenda da métrica, AOI demarcada, intervalo selecionado, proveniência e mensagem sobre cobertura. A câmera começa na AOI piloto.

- Visão afastada: agregados por célula, nunca centenas de milhares de pontos brutos.
- Clique/hover na célula: valor, período, base, cobertura e incerteza se estimada.
- Mudança de período: somente arquivos da resolução necessária.
- P1: seleção de mais de uma região, filtros por sensor e exportação espacial.
- Se não houver material agregável confiável em tempo hábil, manter um mapa estático explicativo com um recorte de dados reais representativos, sem insinuar atualização ao vivo.

### 4.5. Metodologia — confiança em primeiro plano

Página P0 com: origem FIRMS; diferenças MODIS/VIIRS; escalas de confiança; definições de FRP e índice relativo; cobertura e interpretação de zeros; dia solar local; associação de satélites; janela de treino/teste; critérios pré-registrados; métricas e gráficos; plano A ou B adotado; limitações e versões de dados/código. O gráfico “Por que harmonizar?” obedece à decisão científica da seção 11.7.

### 4.6. Responsividade, acessibilidade e estados

Calendário rolável horizontalmente em telas estreitas com legenda e painel acessíveis; seleção via teclado ou lista alternativa por ano/dia; foco visível; textos e padrões redundantes às cores; gráfico com resumo textual. P0 prioriza desktop para a apresentação e verifica mobile em dispositivo real. Gráficos devem possuir textos equivalentes, não apenas canvas sem descrição.

## 5. Arquitetura técnica do MVP

### 5.1. Princípio

**Precompute once, serve many.** O processamento científico roda offline. O build publica apenas arquivos derivados, JSON/GeoJSON compactados e interface React. No browser não se roda harmonização científica nem se baixa o arquivo histórico integral.

### 5.2. Componentes (proposta de implementação)

| Camada | Tecnologia sugerida | Responsabilidade | Prioridade |
| --- | --- | --- | --- |
| Aplicação | React + TypeScript + Vite | UI, estado de filtro, renderização do calendário e detalhes | P0 |
| Estilo | CSS/Tailwind, se a equipe já dominar | Layout responsivo, tema, estados visuais | P0 |
| Mapa | MapLibre GL JS ou biblioteca já conhecida da equipe | H3/GeoJSON e AOI | P0 |
| Gráficos | SVG/D3 leve ou biblioteca já dominada | Curvas, comparação e diagnósticos | P0 |
| Pipeline offline | Python, pandas, bibliotecas geoespaciais/H3 | ETL, agregação, calibração, testes e exportação | P0 |
| Persistência MVP | Arquivos versionados | Manifesto, série agregada, mapa e relatório de validação | P0 |
| Hospedagem | **Vercel, único deploy estático** | Frontend + assets | P0 |
| Backend | FastAPI, apenas se necessidade justificada | Consulta dinâmica futura | P1 |
| Banco espacial | PostgreSQL/PostGIS se o produto crescer | AOIs arbitrárias, consultas on-demand | Pós-MVP |

A escolha exata das bibliotecas é **proposta de execução**, não requisito científico. **Excluir do MVP** `docker-compose`, React Hook Form, autenticação, filas, banco e API de produção sem justificativa real.

### 5.3. Fluxo de construção

```text
FIRMS archive / arquivos oficiais
          │
          ▼
   ingestão e verificação
          │
          ▼
 normalização + proveniência
          │
          ▼
 qualidade + dia solar + H3
          │
          ▼
 ensaios de combinação/sensores
          │
          ▼
 calibração + validação  ──────► decisão A/B
          │                            │
          └──────────┬─────────────────┘
                     ▼
        agregados diários + mapa
                     │
                     ▼
          JSON / GeoJSON / manifest
                     │
                     ▼
            React/Vite + Vercel
```

### 5.4. Contrato entre ciência e frontend

O frontend **não** espera o processo de dados: usa `fixtures` com exatamente o mesmo formato de `Activity Aggregate`, `Dataset Manifest` e `Validation Summary`. Os arquivos de demo não podem aparecer como dados reais. Ao integrar os artefatos verdadeiros, remover as fixtures da compilação pública e manter a chave `data_status=real` verificada no manifesto.

### 5.5. Gestão do volume

Enviar agregados por AOI-dia para o heatmap e blocos geográficos ou janelas temporais delimitadas para o mapa. Evitar download completo de detecções brutas no browser. Medir tempo de carregamento e tamanho transferido na demo real; a escala de “poucas dezenas de milhares de feições” é **hipótese de desempenho**, não garantia.

## 6. Dados de origem, unidades e limitações

### 6.1. Fonte e disponibilidade

**NASA FIRMS** é a fonte de detecções ativas MODIS e VIIRS. Preferir **Standard Processing (SP)** para análise histórica; caso NRT seja usado em trechos recentes, distingui-lo explicitamente e reconhecer que registros NRT podem ser substituídos por ciência definitiva. As datas efetivas e lacunas devem vir do manifesto da extração, não de suposições.

| Família | Plataformas consideradas | Escala espacial nominal | Recorte temporal de referência |
| --- | --- | --- | --- |
| MODIS | Terra, Aqua | ~1 km | Terra desde nov/2000; Aqua desde jul/2002 |
| VIIRS | S-NPP, NOAA-20, NOAA-21 | ~375 m no nadir | S-NPP desde jan/2012; NOAA-20 desde abr/2018; NOAA-21: conferir coleção efetivamente disponível |

A divergência entre páginas da NASA sobre o início de cobertura de NOAA-21 exige registrar o **primeiro registro válido usado** e sua coleção no manifesto, sem fixar uma data apenas pelo nome da plataforma.

### 6.2. Semântica dos dados

`frp` corresponde a potência radiativa do fogo (MW) por detecção; a soma por AOI-dia será usada como **índice relativo comparativo**, e não como energia total ou área queimada. MODIS fornece `confidence` numérica (0–100), VIIRS classifica confiança `low/nominal/high`; os números não são equivalentes à classe por conversão direta. Resolução espacial e horário de observação afetam detectabilidade.

### 6.3. Observação, cobertura e zero

**Risco metodológico crítico:** um CSV de **detecções positivas** por si só não prova que uma região foi observada adequadamente nos dias sem detecções. A regra `coverage_flag=ok` precisa basear-se em evidência de passagens/observação disponível, metodologia documentada ou uma definição conservadora aprovada por André. Na ausência dessa evidência, marcar `partial/no_data` ou “cobertura indeterminada”, não inventar zero. `overpass_count` é registro de contexto, não prova automática de cobertura limpa de nuvens.

### 6.4. Região piloto

Pantanal brasileiro é a **AOI sugerida**, sujeito à confirmação. Registrar polígono e versão do limite (fonte, CRS, data), método de interseção (centro do pixel vs geometria, conforme possibilidade), extensão temporal acessível e recorte de teste. A AOI piloto deve ser a mesma nas comparações de sensores, evitando diferenças artificiais de área.

### 6.5. Política de versão e reprodutibilidade

Armazenar: dataset de origem, coleção/processamento, download UTC, filtros, AOI, hash de insumos, versão de código, parâmetros, janela de treino/teste e versão exportada. Não republicar arquivos de dados brutos com limitações de licença/uso sem verificá-las. Um README reproduz o processamento a partir de FIRMS.

## 7. Modelo de dados e contrato científico

### 7.1. Raw Detection

Cada linha retém os campos originais relevantes e a proveniência. Campos mínimos propostos para a implementação, além dos complementos oficiais definidos na seção 7.3:

| Campo | Semântica |
| --- | --- |
| `detection_id` | Identificador técnico derivado e estável, sem alegar identidade de evento |
| `source_dataset`, `collection`, `processing_level` | Produto FIRMS e SP/NRT |
| `sensor`, `satellite` | MODIS/VIIRS; Terra/Aqua/S-NPP/NOAA-20/NOAA-21 |
| `latitude`, `longitude` | Centro do pixel reportado |
| `acquired_at_utc` | Data/hora de aquisição UTC preservada |
| `frp_mw` | FRP no produto original |
| `confidence_raw` | Valor original, numérico ou categórico |
| `region_id`, `cell_id` | AOI e célula de agregação derivadas |
| `quality_pass`, `quality_rule_version` | Aplicação rastreável de filtros |

**Não criar ID de “incêndio” com base em proximidade entre pixels.**

### 7.2. Entidades complementares

- **Region/AOI:** `region_id`, nome, geometria/fonte, bbox, versão do polígono, idioma e intervalo disponível.
- **Dataset Manifest:** versão global, data de geração, dados/fontes usados, período real por sensor, plano A/B, limiares, versões de calibração, hashes, cobertura e endereços dos arquivos derivados.
- **Validation Summary:** período de treino/teste, métricas por plataforma/estrato, status `passed|failed|not_run`, justificativas, seleção de combinação e decisão A/B.
- **Daily/Map Assets:** agregados derivados do mesmo pipeline e com os mesmos identificadores de versão.

---

## 7.3. Activity Aggregate (revisada) e acréscimos à 7.1

### Acréscimos à 7.1 (Raw Detection)

| Campo | Tipo | Motivo |
| --- | --- | --- |
| day\_night | D / N | Horários de passagem diferem; estratificar e separar |
| scan, track | Float | Tamanho real do pixel |
| local\_solar\_date | Date | Derivada de UTC e longitude, com regra única para a virada da meia-noite; evita misturar noites de dias diferentes |
| source\_type | String nullable | Filtrar fogo de vegetação e fontes estáticas, quando disponível |
| confidence\_class | Enum derivado | Classe comparável, mantendo confidence\_raw intacto |

### Activity Aggregate

Representa uma agregação por período e unidade espacial, já na escala harmonizada.

| Campo | Descrição |
| --- | --- |
| region\_id | Região ou AOI |
| cell\_id | Célula H3, nulo quando a agregação é por AOI |
| period\_start, period\_end | Limites do período |
| temporal\_resolution | day, week ou month |
| spatial\_resolution | Resolução H3 ou aoi |
| metric\_name | Ex.: harmonized\_frp\_index |
| metric\_value | Valor do índice; nulo quando não há dado |
| value\_basis | observed\_modis, observed\_viirs, observed\_both ou estimated\_from\_modis |
| uncertainty\_lower, uncertainty\_upper, interval\_level | Faixa de incerteza e seu nível (ex.: 80%) |
| modis\_frp\_sum, viirs\_frp\_sum | Soma de FRP por sensor, em escala original |
| modis\_detection\_count, viirs\_detection\_count | Contagens por sensor |
| coverage\_flag | ok, partial ou no\_data |
| coverage\_fraction | Fração do período com observação |
| baseline\_median, baseline\_p10, baseline\_p90, baseline\_n\_years | Referência sazonal (sem o próprio ano) |
| percentile\_rank, robust\_z | Posição na referência e magnitude |
| is\_unusual | Regra da seção 11.4 |
| calibration\_version, methodology\_version, dataset\_version | Rastreabilidade |

### Campos adicionais (patch)

| Campo | Descrição |
| --- | --- |
| is\_extrapolated | Verdadeiro para valores estimados fora do período de sobreposição MODIS–VIIRS |
| estimation\_method | Método que produziu a estimativa (ratio, quantile\_map ou gbm) |
| calibration\_stratum | Estrato usado na calibração (AOI, plataforma, dia/noite, estação) |
| overpass\_count | Passagens consideradas no período; registrado, sem normalização automática |

**Regra de zero vs. ausência:** metric\_value fica nulo com coverage\_flag = no\_data. Zero só é gravado quando a cobertura está adequada e não houve detecção.

### Calibration Record (novo)

Um registro por estrato calibrado.

| Campo | Descrição |
| --- | --- |
| stratum | AOI, plataforma (Terra ou Aqua), dia/noite e estação |
| method | ratio, quantile\_map ou gbm |
| parameters | Parâmetros ajustados |
| training\_period, test\_period | Períodos de treino e teste |
| validation\_metrics | MAE, viés, Spearman e cobertura dos intervalos |
| created\_at, code\_version | Rastreabilidade |

**Limiares de aprovação:** o registro de calibração guarda também acceptance\_thresholds (Spearman mínimo nas séries semanais, viés máximo, cobertura mínima dos intervalos de 80% e amostra mínima por estrato), com data e hora de registro anteriores à execução dos testes. Os estratos separam Terra e Aqua.

---

## 8. Interfaces de dados, contratos e exemplos

No MVP, “endpoints” significam **arquivos estáticos sob `/data/v1/`**. A seção 8.5 mantém os parâmetros lógicos da API futura, mas a implementação P0 resolve filtros por arquivos pré-computados e estado local, sem servidor ativo.

### 8.1. Manifesto

`GET /data/v1/manifest.json` (arquivo estático). Modelo ilustrativo, **não representa resultado científico**:

```json
{
  "schema_version": "1.0.0",
  "dataset_version": "REPLACE_WITH_REAL_VERSION",
  "methodology_version": "1.2",
  "generated_at_utc": null,
  "data_status": "fixture",
  "decision": "pending",
  "harmonization_approved": false,
  "region_ids": ["pantanal-pilot"],
  "sources": ["MODIS", "VIIRS"],
  "spatial_resolution": "h3-6",
  "temporal_resolutions": ["day", "week", "month"],
  "actual_date_range": null,
  "coverage_method": "pending_scientific_review",
  "files": {
    "calendar_day": "/data/v1/regions/pantanal-pilot/calendar/day.json",
    "validation": "/data/v1/validation/summary.json"
  }
}
```

`data_status: fixture` **impede o frontend de exibir os valores como observações reais**; a publicação final com dados científicos só muda para `real` após verificação das versões e do arquivo.

### 8.2. Regiões

`GET /data/v1/regions/index.json` lista id, nome, polígono simplificado/bbox, fonte de geometria, intervalo observado e disponibilidade de bases. P0 pode conter apenas a AOI piloto.

### 8.3. Relatório de validação

`GET /data/v1/validation/summary.json`, contendo: `decision`, `thresholds_registered_at`, `thresholds`, `training_period`, `test_period`, `results_by_platform`, `combination_rule`, `coverage_method`, `pre2012_notice`, `limitations`, `calibration_version`, `dataset_version`. Se `decision=plan_b`, a UI desativa a visão harmonizada.

### 8.4. Dados geográficos

`GET /data/v1/regions/{region_id}/map/{period_key}.geojson` ou um arquivo agregado equivalente, com propriedades por célula: `cell_id`, `period_start`, `period_end`, `metric_name`, `metric_value`, `value_basis`, `coverage_flag`, `uncertainty_lower`, `uncertainty_upper`, `dataset_version`. Todos os arquivos devem declarar a mesma versão de dataset do manifesto; qualquer divergência bloqueia a interpretação e mostra erro de integridade.

### 8.5. Calendar (contrato lógico obrigatório)

**Entrada:** `region_id`, `resolution=day|week|month`, `basis=harmonized|modis|viirs`, `year`/intervalo opcional. Em P0, arquivos estáticos existem por resolução e região, e o frontend seleciona a base a partir dos registros entregues. Em P1, a API dinâmica poderá usar `GET /api/calendar?region_id=...&resolution=...&basis=...`.

**Resposta:** `{region_id, resolution, basis, dataset_version, calibration_version, coverage_method, records: ActivityAggregate[]}`. Cada `ActivityAggregate` inclui os campos **completos** da seção 7.3, em especial `value_basis`, `uncertainty_lower`, `uncertainty_upper`, `coverage_flag`, `coverage_fraction`, `baseline_median`, `baseline_p10`, `baseline_p90`, `baseline_n_years`, `is_extrapolated` e `overpass_count`.

**Exemplo sintético de registro** (valores intencionalmente fictícios):

```json
{
  "region_id": "pantanal-pilot",
  "cell_id": null,
  "period_start": "2011-08-01",
  "period_end": "2011-08-02",
  "temporal_resolution": "day",
  "spatial_resolution": "aoi",
  "metric_name": "harmonized_frp_index",
  "metric_value": 27.4,
  "value_basis": "estimated_from_modis",
  "is_extrapolated": true,
  "estimation_method": "ratio",
  "calibration_stratum": "pantanal-pilot|Terra|D|dry",
  "uncertainty_lower": 14.1,
  "uncertainty_upper": 40.9,
  "interval_level": 0.8,
  "modis_frp_sum": 21.3,
  "viirs_frp_sum": null,
  "modis_detection_count": 4,
  "viirs_detection_count": null,
  "coverage_flag": "ok",
  "coverage_fraction": 1.0,
  "overpass_count": 2,
  "baseline_median": 18.0,
  "baseline_p10": 7.0,
  "baseline_p90": 32.0,
  "baseline_n_years": 9,
  "percentile_rank": 0.78,
  "robust_z": 0.8,
  "is_unusual": false,
  "calibration_version": "illustrative-only",
  "methodology_version": "1.2",
  "dataset_version": "fixture"
}
```

**Regra de integração:** este exemplo é fixture para desenvolvimento, não foi extraído de FIRMS nem validado. Só haverá publicação de entradas `estimated_from_modis` com `harmonization_approved=true` após aprovação científica. No plano B, entradas estimadas exploratórias devem ser diferenciadas da métrica harmonizada aprovada (inclusive em `metric_name` e no texto visível).

### 8.6. Casos obrigatórios de consistência

- `coverage_flag=no_data` ⇒ `metric_value=null` e representação de ausência; não interpolar para zero.
- Zero detectado ⇒ `metric_value=0` somente com critério de cobertura adequado e documentado.
- `is_extrapolated=true` ⇒ `value_basis=estimated_from_modis` e aviso explícito de não validação direta antes da sobreposição.
- `observed_modis` e `observed_viirs` nunca são exibidos como unidades diretamente comparáveis sem método.
- `harmonization_approved=false` ⇒ remover opções e rótulos que insinuem uma harmonização validada.
- `validation.status=not_run` ⇒ não contar como aprovação.

## 9. Organização de repositório e engenharia

Estrutura proposta, adaptável às competências do time:

```text
chronoflare/
├── README.md
├── docs/
│   ├── methodology.md
│   ├── data-dictionary.md
│   ├── validation-report.md
│   └── submission.md
├── app/
│   ├── src/
│   │   ├── components/     # heatmap, legenda, detalhes, controles
│   │   ├── pages/          # Calendar, Map, Methodology
│   │   ├── data/           # loader, adapters, validação do contrato
│   │   ├── fixtures/       # EXCLUSIVAMENTE desenvolvimento
│   │   ├── styles/
│   │   └── types/
│   ├── public/data/v1/    # artefatos científicos exportados
│   ├── package.json
│   └── vite.config.ts
├── science/
│   ├── scripts/           # ingest, normalize, aggregate, calibrate
│   ├── tests/             # séries, calendário, bootstrap, splits
│   ├── configs/           # região, filtros, limiares pré-registrados
│   └── outputs/           # não versionar arquivos brutos pesados
└── .github/workflows/     # CI simples, se houver tempo
```

**Regras:** branch principal sempre demonstrável; PR pequeno e revisão rápida; artefatos de dados com versão e checksum; segredos Earthdata/MAP_KEY apenas em ambiente local, nunca no frontend, no bundle ou no repositório. A demo não consulta diretamente endpoints autenticados de FIRMS.

## 10. Qualidade, testes e observabilidade

### 10.1. Testes de dados P0

Verificar esquema, tipos e enums; data UTC e dia solar; limites das janelas; ano bissexto; consistência de somas e agregações; nulidade em ausência; separação de plataformas; duplicação e proveniência; mudança na entrada de plataformas; série simulada conhecida; reexecução idempotente; consistência de versões. Testar que retirar NOAA-21, quando presente, não altera silenciosamente a interpretação de anos anteriores.

### 10.2. Testes do produto P0

Abrir app em rede limpa; trocar base sem misturar unidades; selecionar dias, semanas e anos; verificar tooltip e legenda para os cinco estados; validar deep-link para mapa com região/período; comparar séries; testar estado sem arquivo ou versão conflitante; modo plano B; navegação por teclado; responsividade; teste em outro dispositivo.

### 10.3. Integridade da publicação

Checklist de build: `data_status=real` somente com dataset e validação genuínos; `decision` presente; fonte e período da AOI declarados; todos os assets referenciados existem; arquivos compactados não excedem o orçamento medido no browser; gráfico de metodologia corresponde ao relatório exportado.

### 10.4. Critérios de desempenho (proposta)

Medir o tempo de abertura no dispositivo de demo e o tamanho de download do calendário e do mapa. Preferir pré-computação e divisão de arquivos ao invés de fixar metas numéricas não medidas. O teste de volume de feições previsto na seção 17 é condição real da demo.

---

## 11. Estratégia científica e analítica

Decisões marcadas como *proposta* dependem da confirmação do André após a análise dos dados.

### 11.1. Princípios obrigatórios

1. Preservar a proveniência dos dados.
2. Não comparar diretamente métricas incompatíveis.
3. Não tratar ausência de observações como zero.
4. Não assumir que detecções próximas representam o mesmo evento.
5. Não eliminar registros originais durante a harmonização.
6. Documentar os métodos de normalização.
7. Manter versões dos métodos e dos conjuntos de dados.
8. Toda série harmonizada é publicada com incerteza.
9. Nenhum resultado harmonizado é exibido antes de passar pela validação fora da amostra (11.5).
10. Satélites do mesmo sensor não são somados; a regra de combinação (máximo por célula-dia ou satélite de referência fixo) é escolhida por experimento (11.2, etapa 4).
11. Datas agrupadas pelo dia solar local, derivado de UTC e longitude.

12. Estimativas anteriores à sobreposição MODIS–VIIRS são extrapolações e nunca são apresentadas como validadas.
13. Os limiares de aprovação são registrados antes da execução dos testes.

### 11.2. Pipeline de harmonização (proposta)

1. **Normalização.** Esquema único de colunas, sensor e satélite preservados.
2. **Filtros de qualidade.** Fogo de vegetação quando houver campo de tipo; excluir fontes estáticas; excluir confiança baixa do VIIRS e aplicar limiar equivalente no MODIS. Registrar a sensibilidade aos limiares.
3. **Agregação.** Grade H3 em resolução 6 (cerca de 36 km², configurável entre 5 e 7), maior que o pixel do MODIS. Unidade: célula × dia × (dia/noite). H3 serve para agregar, não para deduplicar.
4. **Associação dentro do sensor.** Terra e Aqua (MODIS) e S-NPP, NOAA-20 e NOAA-21 (VIIRS) podem ver o mesmo fogo no mesmo dia. Isso é um experimento, não uma regra: testar (a) máximo por célula-dia e (b) satélite de referência fixo, nos mesmos períodos e unidades espaciais. O máximo pode descartar atividade de eventos distintos vista por só um satélite; a soma pode duplicar atividade persistente. A escolha considera viés em relação à referência, estabilidade temporal, correlação entre séries, sensibilidade à entrada de novos satélites e cobertura. Registrar overpass\_count e a regra escolhida. Satélites que entram na série ao longo do tempo criam degraus artificiais: conferir a disponibilidade de cada um no FIRMS e testar se incluir NOAA-21 altera a série na sobreposição. Se alterar, adotar uma referência fixa.
5. **Calibração na sobreposição (2012 em diante).** Alvo: escala VIIRS equivalente. Período principal de calibração: 2012–2019, hipótese de maior estabilidade orbital do MODIS a confirmar pelo André; 2020–2025 serve de teste de estresse. Terra e Aqua são analisadas separadamente. Escada de modelos, parando no primeiro que validar bem:
   - Razão mediana MODIS→VIIRS por estrato.
   - Mapeamento por quantis da distribuição da soma de FRP.
   - GBM com variáveis de contexto (P2).
6. **Incerteza.** Intervalos por regressão quantílica ou bootstrap de resíduos por estrato, propagados até o calendário.
7. **Série harmonizada.** VIIRS observado onde existir; VIIRS equivalente estimado, com faixa, antes disso; na sobreposição, observado e estimado lado a lado.
8. **Índice principal.** Soma de FRP em escala VIIRS equivalente por AOI-dia. É um indicador relativo de atividade, não a energia total liberada.

**Hipótese a testar logo no início:** a soma de FRP é mais comparável entre sensores do que a contagem, porque a contagem depende fortemente da resolução. Critério de decisão: escolher a métrica com maior correlação de postos e menor viés no teste fora da amostra. Plano B: contagem calibrada por estrato.

**Diagnóstico de estacionariedade:** gráfico anual da razão MODIS/VIIRS, com Terra e Aqua separados. Há relatos de deriva de órbita e de mudança no horário de passagem de Terra e Aqua nos últimos anos; as datas e os efeitos precisam ser confirmados pelo André nas fontes da NASA e do NSIDC. Não presumir que a relação foi estável nem que foi quebrada. Se o viés mudar de forma sistemática, testar estratificação por período ou por plataforma. A normalização pelo número de passagens só entra se melhorar a comparabilidade.

### 11.3. Burning Activity Calendar

- **Resolução:** série diária original como base de todos os cálculos; média móvel de 7 dias apenas como opção visual; semana e mês como agregações exploratórias.
- **Referência sazonal:** para cada mês-dia, janela de ±15 dias em todos os anos, excluindo o ano avaliado (leave-one-year-out). O 29/02 é tratado por regra documentada **somente na referência sazonal** (proposta: referência de 365 dias, com o 29/02 agregado ao 28/02), sem deslocar os dias seguintes. **A observação original do dia 29/02 permanece preservada no dataset e na série diária.**
- **Amostra mínima:** número mínimo de anos configurável (proposta: 8). Abaixo disso, a referência é marcada como insuficiente.
- **Cobertura:** períodos sem dados suficientes são identificados e exibidos separadamente do zero.
- **Transparência:** o tamanho da amostra e a metodologia da referência aparecem no painel de detalhes.

### 11.4. Anomalias e janelas críticas (proposta)

**Período incomum:** valor diário acima do P90 da referência por pelo menos 3 dias seguidos, calculado sobre a série diária original e não sobre a média móvel. A magnitude é dada pelo z robusto (mediana e MAD). Em anos estimados a partir do MODIS, a anomalia só é declarada se o limite inferior da faixa de incerteza ultrapassar o P90; caso contrário aparece como *possível*.

**Janela crítica:** na curva cumulativa do ano mediano, início aos 10%, pico no máximo suavizado e fim aos 90%. Repetir por ano para medir antecipação, duração e tendência da temporada (tendência: P1).

Toda anomalia responde: qual período, qual indicador, qual referência, qual desvio e qual método. Isso não é previsão de incêndios.

### 11.5. Validação

- **Teste fora da amostra:** calibrar em um período e testar em outro (testes na tabela abaixo; períodos a ajustar após a confirmação das datas). Métricas: erro absoluto médio, viés, correlação de postos (Spearman) em séries semanais e cobertura dos intervalos de 80%.
- **Comparação de abordagens:** MODIS puro, emenda ingênua e harmonizada.
- **Consistência entre satélites:** S-NPP contra NOAA-20 como verificação de sanidade.
- **Sensibilidade:** resolução H3, limiar de confiança e janela da referência.
- **Reprodutibilidade:** parâmetros e versão dos dados registrados no Calibration Record.

**Testes (proposta; períodos a ajustar após a confirmação das datas)**

| Teste | Treino | Teste | O que avalia |
| --- | --- | --- | --- |
| Validação temporal | 2012–2019 | 2020–2025 | Teste de estresse: a relação se mantém depois de uma possível deriva orbital |
| Transferência para trás | 2016–2025 | 2012–2015 | Complementar; estabilidade em anos anteriores. Não valida o período pré-2012 |

Resultados separados para Terra e Aqua.

**Limiares de aprovação (registrar antes de rodar os testes):** Spearman mínimo nas séries semanais, viés máximo aceitável, cobertura mínima dos intervalos de 80% e amostra mínima para considerar cada estrato válido. Os valores são definidos pelo André conforme a qualidade e a variabilidade dos dados, com data e hora do registro.

**Limitação pré-2012:** as estimativas anteriores à sobreposição são extrapolações da relação calibrada. A incerteza reflete a do modelo e não constitui validação direta contra o VIIRS. Versão para o pitch: *Historical estimates before 2012 are extrapolations based on the MODIS–VIIRS relationship calibrated during their overlap period. They are not directly validated against VIIRS observations.*

Os resultados alimentam a página de Metodologia e o gráfico ‘Por que harmonizar?’.

### 11.6. Prazo das decisões pendentes

O registro de decisões e pendências da seção 18 (fonte, campos, confiança, associação, indicador, agregação, resolução e método de anomalia) deve ser atualizado antes do checkpoint científico de 3 horas da seção 11.7. Sem evidência suficiente, aplicam-se os padrões provisórios explicitados neste documento **somente para desenvolvimento e experimentação**; valores não aprovados não podem ser publicados como resultados harmonizados. O desenvolvimento da interface não fica bloqueado: usa dados fictícios conformes ao contrato.

### 11.7. Checkpoint de decisão (3 horas) e plano B

O limite de 3 horas é um limite de decisão, não uma garantia de conclusão. Ao final, o time decide entre plano A e plano B, mesmo que a conclusão seja que não há evidência suficiente para harmonizar. Ingestão e download dos dados ficam fora desse relógio, com limite próprio definido pelo André no início.

1. **Hora 1:** dados da sobreposição, comportamento da série em 2012 e qualidade.
2. **Hora 2:** máximo por célula-dia contra satélite de referência fixo (a média fica fora do escopo inicial) e calibração simples por razão mediana por estrato.
3. **Hora 3:** validação temporal, transferência para trás e gráfico anual da razão MODIS/VIIRS por plataforma.
4. **Decisão:** aplicar os limiares registrados antes dos testes.

| Item | Plano A (passou nos limiares) | Plano B (não passou) |
| --- | --- | --- |
| Série exibida | Harmonizada, com incerteza | MODIS e VIIRS separados |
| Sobreposição | Observado e estimado lado a lado | Comparação direta, com razão mediana por estrato |
| Pré-2012 | Estimativa em escala VIIRS, rotulada como extrapolação | MODIS original, claramente identificado; ou estimativa exploratória em escala VIIRS, rotulada como baixa confiança e não validada |

No plano B, nenhuma série que não passou na validação é apresentada como harmonizada. A narrativa continua honesta: o projeto demonstra por que a comparação direta é enganosa e quanto da diferença entre sensores é explicável. A complexidade da calibração não pode consumir o restante do hackathon.

---

## 12. Priorização, dependências e gestão de risco

### 12.1. Priorização de produto

| P0 — necessário | P1 — só com P0 estável | P2 — fora do hackathon |
| --- | --- | --- |
| Calendário ano × dia; cinco estados e legenda | Exportação PNG/CSV | Modelo GBM e ML exploratório |
| Filtro de base; painel de detalhes; comparação de anos | Análise de tendência da temporada | AOIs ilimitadas e consultas on-demand |
| Metodologia, validação, versão, limitações | FastAPI opcional | Banco espacial e processamento distribuído |
| Mapa simples com agregação | Mais filtros e resolução | Contas, alertas e previsões |
| Dados reais, decisão A/B, vídeo de reserva | Refinamento de design | Serviços em tempo real |

### 12.2. Matriz de riscos

| Risco | Impacto | Prevenção e resposta |
| --- | --- | --- |
| Não conseguir baixar a série completa a tempo | Alto | Recorte piloto viável e arquivos já disponíveis; registrar cobertura histórica efetiva; plano B |
| Harmonização não validar | Alto | Limiares pré-registrados; checkpoint rígido; apresentação separada MODIS/VIIRS |
| Pouca amostra por estrato | Alto | Reportar insuficiência; sem aprovação por ausência de teste; simplificar estratos com justificativa |
| Confundir cobertura e ausência de detecções | Alto | Não afirmar zero sem evidência de cobertura; campo explícito |
| Deriva orbital ou troca de satélite enviesar série | Alto | Terra/Aqua separados; diagnóstico anual; variante de referência fixa |
| Inconsistência de interface e dataset | Alto | Contrato v7.3 e fixture desde a primeira hora; validação do manifesto |
| Peso excessivo de mapa | Médio | Agregação H3, arquivos recortados, teste em hardware comum |
| Escopo explodir | Alto | Três telas; FastAPI fora do P0; nenhum modelo sofisticado sem necessidade |
| Apresentação/submissão ficar para o final | Alto | Responsável nomeado, roteiro cedo, vídeo reserva, envio com folga |
| IA introduzir erro científico ou código incorreto | Alto | Registrar uso; revisão humana do código, gráficos e afirmações |

### 12.3. Regra de redução de escopo

Priorizar a trilha **Calendário → Detalhes → Metodologia → Mapa simples**, mantendo dados verdadeiros e a decisão A/B. Se faltar tempo, reduzir refinamentos visuais e funcionalidade secundária antes de remover transparência, validação ou proveniência. Uma demo científica honesta, mesmo no plano B, é superior a uma série apresentada de modo indevido.

## 13. Implantação e distribuição

### 13.1. Deploy do hackathon

Um único projeto estático na **Vercel**, com build do frontend e `public/data/v1/` contendo arquivos derivados. O pipeline científico é executado antes do build/publicação. Não publicar dados brutos pesados, chaves da NASA ou scripts com credenciais. Configurar SPA fallback/rotas e cache compatível com versões (assets versionados por dataset quando necessário).

### 13.2. Publicação reproduzível

1. Validar testes e `manifest.json`.
2. Copiar saídas validadas para `app/public/data/v1/`.
3. Executar build e verificar tamanho dos arquivos.
4. Abrir preview e confirmar plano A/B, fonte, limites, rotas e interações.
5. Publicar e testar pelo link em dispositivo diferente.
6. Gravar vídeo de demonstração com caminho alternativo caso a hospedagem ou internet falhe.

### 13.3. Futuro pós-evento

Somente depois do MVP: backend FastAPI, consulta dinâmica de AOIs, persistência espacial PostGIS e jobs de atualização. Essas mudanças exigem testar custos, reprodutibilidade e proteção contra mistura de SP/NRT; não são parte da arquitetura inicial.

---

## 14. Plano de execução (ajustes pontuais)

O trabalho corre em quatro frentes paralelas desde a largada, com um checkpoint comum.

| Frente | Responsável | Entrega prioritária |
| --- | --- | --- |
| Aplicação | Tech Lead | Calendário ano × dia do ano, painel de detalhes, alternância de base, estados visuais e arquitetura estática, tudo com dados fictícios no formato do contrato da 7.3 |
| Dados e metodologia | André | Extração da sobreposição, verificação de 2012, variantes de agregação, calibração, validações, diagnóstico de estabilidade e dataset histórico |
| Front e produto | Dev front/produto | Identidade visual, componentes, responsividade e mapa simples |
| Apresentação | A nomear | Roteiro, vídeo, narrativa científica e submissão |

1. O front começa já, com dados fictícios. A troca pelo dataset real acontece quando o André entregar.
2. O André entrega primeiro a análise da sobreposição e a verificação de 2012. O resultado orienta a interpretação científica, a escolha da base exibida e a substituição dos dados fictícios pelos reais; **não bloqueia a construção do calendário**, iniciada desde o começo.
3. O checkpoint de 3 horas (11.7) termina com a decisão entre plano A e plano B.
4. Mapa simples, Metodologia e o gráfico ‘Por que harmonizar?’ entram com os resultados reais.

**Enquadramento do pitch:** o ChronoFlare não é uma reconstrução perfeita da atividade de queima desde 2000. É uma tentativa reproduzível de construir uma série histórica mais comparável, com validação na sobreposição, estimativas retrospectivas declaradas e incerteza explícita.

---

## 15. Comunicação, pitch e submissão

### 15.1. Narrativa científica central

**Problema:** sensores distintos revelam tendências aparentes que podem refletir mudança de resolução, cobertura, plataforma e processamento, não apenas mudança ambiental.

**Proposta:** uma interface que combina série histórica, origem dos dados, sazonalidade e transparência sobre estimativa e incerteza. **Prova:** validação temporal na sobreposição ou demonstração documentada do limite da harmonização, sem esconder falhas.

**Valor:** permitir que alguém enxergue quando a atividade detectada normalmente acontece, selecione um ano incomum e compreenda por que aquela comparação é — ou não é — confiável.

### 15.2. Roteiro de demo (proposta)

1. **Abertura:** uma frase com o problema da comparabilidade MODIS/VIIRS.
2. **Calendário:** mostrar padrão sazonal da AOI piloto e selecionar um período incomum.
3. **Detalhes:** explicar observado/estimado, intervalo e referência histórica.
4. **Mapa:** relacionar o período com a distribuição espacial agregada.
5. **Metodologia:** mostrar comparação entre sensores, métricas e resultado da decisão A/B.
6. **Conclusão:** deixar explícitas extrapolações pré-2012 e usos não recomendados.

### 15.3. Mensagens a manter no material final

- *Understanding fire activity through time.*
- *ChronoFlare does not claim to reconstruct a perfect history since 2000.*
- *Historical estimates before 2012 are extrapolations based on the MODIS–VIIRS relationship calibrated during their overlap period. They are not directly validated against VIIRS observations.*
- Os dados são **focos térmicos ativos detectados por satélite**, não incêndios confirmados ou ferramenta operacional de emergência.

### 15.4. Materiais de submissão

Link público; repositório acessível; README de instalação/reprodução; descrição do problema e da solução; fontes NASA e licenças; metodologia e limitações; vídeo de demonstração; declaração de uso de IA e revisão humana; evidência visual da validação/decisão A/B. O time deve conferir o prazo e formato **efetivos** do evento local e enviar com pelo menos 4 horas de folga, conforme seção 17.

## 16. Equipe, papéis e coordenação

| Frente | Pessoa / papel | Responsabilidades | Primeiro marco |
| --- | --- | --- | --- |
| Tech Lead / desenvolvimento | Usuário (Tech Lead) | Arquitetura, integração do contrato, calendário, build e deploy; coordenação técnica | Página funcional com fixtures |
| Dados e ciência | André | FIRMS, AOI, qualidade, calibração, testes, limitações, artefatos versionados | Análise de sobreposição e pré-registro de limiares |
| Front / produto | Desenvolvedora front/produto | Identidade, componentes, estados, mapa, responsividade e UX | Mapa e componentes com fixtures |
| Narrativa / apresentação | **A nomear imediatamente** | Roteiro, vídeo, redação, evidências científicas e envio | Estrutura do vídeo e checklist de entrega |

### 16.1. Contratos de handoff

André → aplicação: `manifest`, `calendar/day|week|month`, `map`, `validation/summary`, definições de métrica e limitações. Aplicação → produto: tipos, dados mockados, componentes integráveis e estados A/B. Narrativa → equipe: script de demo alinhado aos resultados científicos efetivos, sem antecipar aprovação da calibração.

### 16.2. Cadência

Sincronização curta ao iniciar e nos checkpoints; registrar decisões em arquivo compartilhado. A equipe não deve impedir a construção da UI pela falta do dataset. Qualquer alteração de regra científica após a decisão A/B precisa de evidência e atualização explícita de versão.

---

## 17. Critérios de aceitação

O projeto estará pronto para demonstração quando cada item abaixo puder ser verificado.

**Produto**

1. A aplicação abre e navega entre Calendário, Mapa e Metodologia sem erros.
2. A região piloto está identificada em todas as telas.
3. O calendário ano × dia do ano exibe dados reais, com os cinco estados visuais da seção 4.3 e legenda.
4. O usuário consegue comparar anos e abrir o painel de detalhes de qualquer período.
5. O mapa exibe dados reais sem enviar volumes que travem o navegador (a meta de carga por consulta, hoje na casa de poucas dezenas de milhares de feições, é validada por teste de desempenho antes de ser tratada como garantia; agregação em zoom distante).

**Dados e ciência**

6. Há dados reais de MODIS e VIIRS; a meta é cobrir desde o início disponível do MODIS até o período recente. O intervalo efetivamente obtido e as lacunas devem ser identificados, sem afirmar cobertura inexistente. **No plano A**, o trecho pré-sobreposição estimado em escala VIIRS é rotulado como extrapolação sem validação direta e tem faixa de incerteza. **No plano B**, o trecho é apresentado em MODIS original ou como estimativa exploratória explicitamente não validada, nunca como série harmonizada aprovada.
7. A origem (sensor e base) de cada valor pode ser identificada.
8. A calibração está documentada e versionada (Calibration Record).
9. A validação temporal e a transferência para trás são reportadas separadamente para Terra e Aqua, com MAE, viés, Spearman e cobertura dos intervalos, contra limiares registrados antes dos testes. Se algum teste não puder ser executado por falta de dados ou tempo, registrar claramente **“não realizado”**, motivo e implicação; **não considerá-lo aprovado** e, na ausência de validação obrigatória, seguir o plano B.
10. O gráfico “Por que harmonizar?” compara MODIS puro, emenda ingênua e série harmonizada **somente no plano A**; no plano B, apresenta os sensores em separado e a comparação na sobreposição. Se o salto de 2012 não existir nos dados reais, isso é documentado sem alterar artificialmente a narrativa.
11. Pelo menos um indicador interpretável de anomalia (percentil e z robusto) aparece com método e referência visíveis.
12. Ausência de dado e zero são distinguíveis em toda a interface.

**Transparência**

13. As limitações estão documentadas: focos térmicos não são incêndios confirmados; nuvens e fumaça ocultam detecções; passagens ocorrem em horários fixos; os dados não devem ser usados isoladamente para proteger vidas ou propriedades.
14. Fontes, bibliotecas e ferramentas estão listadas, e o uso de IA está descrito (ferramentas, tarefas e verificações humanas).
15. O README permite recriar o dataset a partir do FIRMS.

**Entrega**

16. A demonstração pública está acessível, testada em outro dispositivo, e existe um vídeo gravado como plano B.
17. Vídeo, descrição, repositório e formulário de submissão estão prontos e enviados com pelo menos 4 horas de folga do prazo do evento local.

**Critérios adicionais (patch)**

18. A inclusão de novos satélites ao longo do tempo não causa degraus artificiais não documentados na série; a regra de combinação escolhida e a comparação entre as variantes estão registradas.
19. Qualquer valor exibido no calendário pode ser reproduzido a partir do dataset, dos parâmetros e da versão da calibração.
20. Os limiares de aprovação foram registrados antes dos testes, e a decisão entre plano A e plano B está documentada com os resultados.
21. No plano B, a interface não apresenta como harmonizada nenhuma série que não passou na validação.

A prioridade é um fluxo completo, cientificamente defensável e explicável, não uma coleção de funcionalidades incompletas.

---

## 18. Registro de decisões, parâmetros pendentes e congelamento

A seção 11.6 aponta para este registro. Os campos abaixo não são convites a reabrir o escopo: são decisões operacionais com donos, testes e condição de publicação.

| Tema | Padrão vigente / decisão | Responsável | Evidência ou ação pendente | Situação |
| --- | --- | --- | --- | --- |
| Nome e posicionamento | ChronoFlare; atividade detectada ao longo do tempo | Equipe | Nenhuma | Fechado |
| Região piloto | Pantanal brasileiro | André | Confirmar AOI, limites e disponibilidade de dados | Proposta |
| Fontes | NASA FIRMS, MODIS + VIIRS; SP prioritário | André | Confirmar coleções e datas efetivas por plataforma | Fechado em princípio |
| Confiança | Preservar `confidence_raw`; filtros por sensor documentados | André | Escolher/avaliar limiar MODIS e VIIRS | Pendente de dados |
| Associação intra-sensor | Comparar máximo por célula-dia versus referência fixa; não somar | André | Resultado empírico e decisão | Pendente de teste |
| Unidade espacial | H3 r6, testar r5–r7 se possível | André | Sensibilidade, compatibilidade e volume | Proposta |
| Calendário | Ano × dia; valor diário original; média 7 dias só visual | Tech Lead + André | Verificar integração | Fechado |
| Indicador principal | Soma FRP em escala VIIRS equivalente por AOI-dia, se passar validação | André | Testar contra contagem calibrada | Pendente de teste |
| Calibração | Razão mediana por estrato primeiro; depois quantis se preciso | André | Ajuste e validação | Pendente de teste |
| Estabilidade orbital | 2012–2019 treino principal, 2020–2025 estresse (proposta) | André | Conferir fontes e diagnóstico Terra/Aqua | Pendente de verificação |
| Transferência para trás | Treino 2016–2025; teste 2012–2015 | André | Executar ou registrar não realizado | Pendente de teste |
| Limiares científicos | Spearman, viés, cobertura 80%, n mínimo | André | **Fixar valores + timestamp antes dos testes** | Obrigatório |
| Cobertura/zero | Zero só se houver cobertura adequada demonstrada | André | Definir e registrar método de cobertura | Crítico |
| Dia solar local / 29/02 | UTC+longitude; 29/02 original preservado; regra só na referência | André | Especificar conversão e testar | Fechado em princípio |
| Anomalia | >P90 por ≥3 dias na série diária; robust z | André | Validar referência e mínimo por estrato | Proposta |
| Série pré-2012 | Extrapolação, sem validação direta | Todos | Mensagem visível | Fechado |
| Plano A/B | Resultado obrigatório após checkpoint científico 3h | André + Tech Lead | Registrar decisão | Obrigatório |
| Escopo de telas | Calendário, Mapa, Metodologia | Time de produto | Integração final | Fechado |
| Infra | Arquivos estáticos, Vercel, sem backend P0 | Tech Lead | Deploy testado | Fechado |
| Apresentação | Nomear responsável, vídeo reserva, submissão antecipada | Equipe | Atribuir papel e conferir prazo local | Aberto |

### 18.1. Critério de congelamento

Após registro de limiares e decisão A/B, ficam congelados para a demo: métrica exibida, tratamento de cobertura, regras de combinação, parâmetros, método de anomalia, narrativa e versão do dataset. Mudanças só entram se houver **evidência, erro comprovado ou bloqueio operacional**, com atualização de versão e recálculo do necessário.

### 18.2. Definition of Done da apresentação

Há uma única URL funcional, dataset e validação rastreáveis, explicação clara de limitações, critérios da seção 17 verificados ou declarados não atendidos, roteiro coerente com o plano científico adotado e submissão efetuada. **Não apresentar como alcançado o que não foi executado.**

---

## Anexo A — Fontes e referências primárias

1. [NASA FIRMS — Active Fire Data](https://firms.modaps.eosdis.nasa.gov/content/active_fire/) — produtos, plataformas, diferenças entre SP e NRT.
2. [NASA FIRMS — Archive Download](https://firms.modaps.eosdis.nasa.gov/download/) — disponibilidade histórica e formatos de download.
3. [NASA FIRMS — VIIRS fire hotspots](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) — atributos e classes de confiança VIIRS.
4. [NASA FIRMS — Fire Alert Notes](https://firms.modaps.eosdis.nasa.gov/alerts/notes.php) — resolução e limitações de detecção, confiança MODIS.
5. [NASA FIRMS — Area API](https://firms.modaps.eosdis.nasa.gov/api/area) — fontes e limites da API, caso necessária na extração.

> A documentação oficial pode apresentar datas de início distintas conforme coleção e etapa de processamento. A versão efetivamente usada no ChronoFlare deve declarar produto, coleção, primeiro/último registro e data de extração. Consultas e resultados científicos não foram executados na produção deste blueprint; os limiares permanecem para definição prévia de André.

## Anexo B — Histórico de consolidação

- **v1.0:** blueprint original referido na revisão, não integralmente disponível neste processo.
- **v1.1:** atualização da estratégia de harmonização, calendário diário, modelo de dados, validação e critérios de aceitação.
- **v1.1.1:** extrapolação pré-2012, suavização só visual, comparação entre satélites, estabilidade temporal, limiares pré-registrados, plano B e execução em paralelo.
- **v1.2 (este documento):** consolidação em 18 seções; seção 14 antes da 17; seção 18 explicitada; critério 9 distingue teste não realizado de teste aprovado; 29/02 mantido nos dados originais; implementação do calendário desacoplada da análise de 2012; critérios 6 e 10 compatíveis com plano B; arquitetura P0 e contratos operacionais reunidos.

**Fim do blueprint.**
