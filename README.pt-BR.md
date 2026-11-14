# ChronoFlare

**Understanding fire activity through time.**

[Read in English](README.md)

Explore o histórico da atividade de queima detectada por satélites MODIS e VIIRS, com origem dos dados, cobertura e incerteza explícitas. Projeto independente para o NASA Space Apps; não é um produto oficial da NASA.

## Estado atual

A aplicação utiliza **dados de atividade inteiramente sintéticos**, identificados na interface. Ainda aguardamos o dataset do André, a confirmação da área de interesse (AOI) do Pantanal, a avaliação de cobertura e a validação científica. A harmonização permanece bloqueada até aprovação.

Já disponível:

- Calendário diário ano × mês/dia, bases originais MODIS/VIIRS, seleção de data, detalhes e comparação do mesmo dia entre anos.
- Telas Calendário, Mapa e Metodologia com data/base preservadas na URL.
- **Imagens de contexto do NASA GIBS** em mapa interativo, com MODIS Terra em cores naturais na data UTC selecionada. Essas imagens reais são independentes do calendário fictício e não possuem camada de focos térmicos nem limite confirmado da AOI.
- **Cliente offline de download NASA FIRMS SP**, com preservação do CSV original e proveniência SHA-256. Exige uma MAP_KEY local; o download real autenticado ainda não foi verificado.
- Validação dos artefatos, testes automatizados, CI e configuração da Vercel.

Referências sazonais, anomalias, incerteza, células H3, calibração e diagnósticos dependem de saídas científicas revisadas. Eles não são inferidos das imagens de contexto.

## Desenvolvimento

Use Node.js 22.12+ ou 24. Python 3.12+ é necessário apenas para o cliente offline e seus testes, sem bibliotecas adicionais.

```sh
npm ci
npm run dev
```

Abra a URL indicada pelo Vite. Para verificar a aplicação:

```sh
npm test
npm run test:science
npm run data:validate
npm run build
```

Teste opcional de conectividade real (Node.js 24.5+, fora da CI; respeita variáveis de proxy):

```sh
npm run sources:check
```

Esse comando verifica um JPEG público do GIBS, não a cobertura de fogo ou a validade científica. O mapa é carregado sob demanda e suas falhas de conexão não alteram os dados do calendário.

## Fontes externas

**NASA GIBS:** conexão direta no navegador para contexto visual, sem chave. As imagens usam data UTC; os agregados de atividade seguem a convenção de dia solar local do pipeline. Ausência de imagem não significa ausência de fogo. Consulte a [documentação GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/).

**NASA FIRMS:** o cliente offline faz uma solicitação explícita e delimitada de dados SP (1–5 dias), usando `FIRMS_MAP_KEY` do ambiente local. Os arquivos brutos ficam fora do frontend. Consulte [a configuração das fontes externas, em inglês](docs/external-sources.md) para configurar a chave, executar um exemplo e entender a proveniência e os limites. Não é necessário adicionar backend, banco ou API autenticada no navegador.

## Entrega científica

Consulte o [contrato de entrega](docs/data-handoff.md), o [blueprint](docs/blueprint-v1.2.md) e o [status de validação](docs/validation-report.md). Os schemas executáveis ficam em `app/src/data/schema.ts`.

O frontend publica artefatos derivados em `app/public/data/v1/`. Substitua o pacote inteiro de fixtures por saídas revisadas e coerentes, depois execute:

```sh
npm run data:validate -- --real
```

Esse comando verifica estrutura; não aprova ciência. O downloader FIRMS não gera os agregados do frontend, não comprova cobertura, não seleciona plataformas, não calibra sensores e não autoriza `data_status=real`.

`npm run fixtures` regenera os dados sintéticos determinísticos. **Não execute após integrar dados reais:** ele substitui os caminhos das fixtures em `app/public/data/v1/`. O build não executa esse comando automaticamente.

## Deploy na Vercel

Importe o repositório usando sua raiz como Root Directory. `vercel.json` define `npm run build` e saída `dist/`. As telas usam query parameters, sem necessidade de rewrite SPA. Esta alteração não cria nem verifica um deploy. Nunca exponha a chave FIRMS nas variáveis do frontend; o GIBS não precisa de chave.

## Organização

```text
app/src/                 Interface React, adaptadores, schemas e testes
app/public/data/v1/      Artefatos derivados estáticos (atualmente sintéticos)
science/scripts/        Cliente offline FIRMS
science/tests/          Testes com respostas de rede simuladas
science/configs/        Decisões científicas pendentes
scripts/                Fixtures, validação e verificação de conectividade
docs/                   Blueprint, handoff e configuração de fontes externas
```

## Próximos marcos

- André: AOI, coleções, datas, cobertura, filtros, combinação de plataformas, limiares pré-registrados e decisão A/B.
- Aplicação: integrar células H3/GeoJSON revisadas, gráficos científicos e comparação anual completa.
- Equipe: revisão humana, teste em navegador/dispositivo, deploy Vercel e apresentação.

## Interpretação e uso de IA

FRP é potência radiativa, não energia total ou área queimada. Focos térmicos não são incêndios individuais confirmados. Bases originais não são diretamente comparáveis; ausência de observação não é zero. Estimativas pré-2012 são extrapolações sem validação direta contra VIIRS. Não é um serviço de previsão ou emergência.

Construído com React, TypeScript, Vite, Zod, Leaflet e biblioteca padrão Python. O Codex auxiliou na implementação e documentação. Código, interface e afirmações científicas exigem revisão humana antes da submissão; nenhum resultado empírico científico foi produzido por IA aqui. A licença do projeto será definida pela equipe.
