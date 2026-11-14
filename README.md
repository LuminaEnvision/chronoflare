# ChronoFlare

**Understanding fire activity through time.**

Exploração histórica da atividade de queima detectada por satélites MODIS e VIIRS, com origem dos dados, cobertura e incerteza explícitas. Projeto independente para o NASA Space Apps; não representa um produto oficial da NASA.

## Estado atual

Primeira implementação do frontend com **dados inteiramente fictícios**. A extração, a AOI do Pantanal e a validação científica dependem do André. Nenhuma harmonização foi aprovada. O mapa ainda aguarda os agregados espaciais; não há pipeline científico implementado nem resultados empíricos.

Implementado: calendário diário por ano, seleção por data acessível por teclado, detalhes, comparação do mesmo dia entre anos, troca de base original, navegação com filtros na URL, metodologia, carregamento com validação e estados de erro. Referência, percentis e intervalos aparecem como indisponíveis enquanto não forem entregues.

## Desenvolvimento

Node.js 22.12+ ou 24 recomendado.

```sh
npm ci
npm run dev
```

Abra a URL indicada pelo Vite. Comandos de verificação:

```sh
npm run test
npm run data:validate
npm run build
```

`npm run fixtures` regenera os artefatos sintéticos determinísticos. **Não execute após integrar dados reais**, pois substitui os arquivos em `app/public/data/v1/`. O build não gera fixtures automaticamente.

## Handoff científico

Consulte [contrato de entrega](docs/data-handoff.md), [blueprint](docs/blueprint-v1.2.md) e [status de validação](docs/validation-report.md). Os schemas executáveis ficam em `app/src/data/schema.ts`.

O frontend consome arquivos estáticos sob `/data/v1/`. Substitua o diretório completo por uma exportação coerente do André e execute `npm run data:validate -- --real` antes da publicação científica. As fixtures devem ser substituídas, não misturadas com os resultados reais. O validador estrutural não substitui aprovação humana da ciência.

## Deploy na Vercel

Importe este repositório na Vercel com a raiz do repositório como Root Directory. `vercel.json` define `npm run build` e saída `dist/`. As telas usam query parameters, sem necessidade de rewrite de SPA. O deploy ainda não foi realizado; o primeiro preview exibirá aviso de dados fictícios.

## Ciência e limites

Fonte prevista: [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/content/active_fire/). FRP é potência radiativa, não energia total ou área queimada. Focos térmicos não são incêndios confirmados. Cobertura insuficiente não é zero; sensores originais não são diretamente comparáveis. Valores estimados pré-2012 são extrapolações sem validação direta contra VIIRS. Não é um serviço de previsão ou emergência.

## Próximas entregas

- André: AOI, coleções, datas efetivas, cobertura, limiares pré-registrados, agregados e relatório A/B.
- Frontend: mapa com GeoJSON/H3 real, gráficos de séries/diagnóstico, referência sazonal e comparação anual completa.
- Equipe: revisão científica/humana, teste em dispositivo real, deploy e materiais da apresentação.

## Ferramentas e uso de IA

React, TypeScript, Vite e Zod; processamento científico offline previsto em Python. Código inicial e documentação produzidos com assistência do Codex. A equipe deve revisar código, interface e afirmações científicas antes da submissão. Nenhum resultado científico foi produzido por IA nesta implementação. Licença do projeto a definir pela equipe.
