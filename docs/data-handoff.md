# André → aplicação

## Pacote mínimo da primeira integração

Entregar uma árvore completa em `app/public/data/v1/`:

- `manifest.json`: schema `1.0.0`, versão do dataset/método, fontes, datas efetivas, status, decisão e paths.
- `regions/pantanal-pilot/calendar/day.json`: envelope e registros completos da seção 7.3, uma linha por data e base, fim de período exclusivo.
- `validation/summary.json`: decisão, status, limiares e timestamp prévio, treino/teste, resultados separados por plataforma, regra de combinação, limitações e versão de calibração.
- Na etapa do mapa: GeoJSON por período/base com H3, AOI confirmada, métrica, cobertura e mesma versão do dataset. O carregador do mapa ainda será implementado com essa entrega.

As estruturas completas de referência estão nos artefatos sintéticos e em `app/src/data/schema.ts`. Campos sem resultado devem continuar nulos; não inventar métricas, passagens, cobertura ou intervalos. Os arquivos de demonstração não são templates de análise científica.

## Convenções da implementação inicial

- Calendário diário por AOI (`cell_id=null`, `spatial_resolution=aoi`), datas ISO, fim exclusivo.
- Envelope `basis=separate` contém linhas `observed_modis` e `observed_viirs` independentes. Para plano A: adicionar linhas `harmonized_frp_index`, incluindo VIIRS observado e estimativas MODIS aprovadas. As originais permanecem separadas.
- `metric_name=modis_frp_sum|viirs_frp_sum` para as bases originais; valor corresponde à soma na escala original, sem somar plataformas automaticamente.
- `metric_value=null` se `coverage_flag=no_data`; zero apenas com cobertura `ok` sustentada por evidência.
- `baseline_*`, percentil e z são específicos da mesma base e calculados offline; não comparar bases em escalas distintas.
- Não há cálculo científico no navegador. O heatmap alinha por mês/dia usando uma grade de ano bissexto, preservando 29/02 sem deslocar março nos outros anos.
- Estimativas exigem intervalo, nível e aprovação. Extrapolações mantêm aviso visível.
- `data_status=real` exige período, geração e método de cobertura; **somente revisão humana pode autorizar esse status**.

## Prova de aprovação

Plano A exige `harmonization_approved=true`, `decision=plan_a` e `validation.status=passed`, versões de calibração coerentes, limiares registrados e resultados. Plano B mantém `harmonization_approved=false` e bases originais. Teste não realizado nunca equivale a aprovação.

Entregar junto: fonte e versão da geometria AOI, coleções SP/NRT e plataformas, primeiro/último registro, hashes dos insumos, filtros, regra de dia solar local e de 29/02 na referência, parâmetros e código reproduzível. O pipeline ainda será implementado: não existe comando de reprodução FIRMS nesta etapa.

## Verificação

```sh
npm run data:validate -- --real
npm test
npm run build
```

Depois: revisar visualmente seleção, lacunas, anos bissextos, bases, plano A/B e versão; integrar o mapa e medir o volume. Publicar dados reais somente após revisão científica.
