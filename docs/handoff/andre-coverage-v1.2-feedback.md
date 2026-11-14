# Feedback para André — cobertura v1.2 e próxima entrega

André, obrigado pela v1.2! Conferimos o conteúdo dos links oficiais e confirmamos
as cinco janelas do MODAPS, incluindo a junção das duas entradas do S-NPP em
2022. Também confirmamos no Update #4 da NOAA e na NASA Earthdata o fim da
entrega de novos dados S-NPP em 02/11/2026 às 15:40 UTC. Essas pendências de
fonte estão resolvidas; não precisa reenviar as mesmas referências.

Já incorporamos o catálogo como evidência negativa de disponibilidade e testamos
a conversão dos intervalos UTC para dias solares. Dois cuidados ficaram explícitos:

- Fora das interrupções conhecidas, a cobertura observada continua desconhecida.
  Operação nominal e uma detecção isolada não comprovam céu limpo em toda a AOI;
  por isso mantemos a regra conservadora sem zeros inferidos e sem estimar
  `coverage_fraction` ou `overpass_count` a partir dos turnos nominais.
- Em 02/11/2026 marcamos que a entrega terminou durante o dia, sem assumir
  exatamente uma passagem ou uma fração de 0,50. Dias solares seguintes ficam
  identificados como posteriores ao encerramento da entrega de novos dados.

Também avançamos no calendário experimental com dados reais de 1–15/08/2020,
separando Terra, Aqua e S-NPP. Buscamos o complemento UTC de 16/08 para fechar o
último dia solar. A API reproduziu os 33.243 registros da referência nos campos
comparados, incluindo `type`, e trouxe 96 adicionais. Registramos a diferença
sem substituir silenciosamente a entrega anterior; a causa ainda está em análise.

Pode seguir para a **Entrega 3 (`indicator.md`)**. Para promovermos a prévia a um
indicador científico aprovado, precisamos fechar:

1. **Filtro final:** confirmar `type=0`, MODIS `confidence>=30` e VIIRS nominal/high,
   além do tratamento dos campos ausentes. Já existe uma opção proposta para
   testar esse filtro na prévia, marcada como não aprovada.
2. **Métrica por plataforma:** definir o que cada valor diário representa, a
   unidade e como entram observações de diferentes passagens. A soma bruta de
   FRP está apenas no detalhe de auditoria, sem ser apresentada como energia,
   área queimada ou métrica harmonizada.
3. **Duplicatas e combinação:** definir quando um registro é duplicado e se deve
   ser removido; depois, como combinar Terra/Aqua caso essa combinação seja
   desejada. Até lá preservamos os registros e as plataformas separadas.
4. **Comparação e validação:** indicar o período/ano comparável e o protocolo de
   referência/validação para a próxima etapa. A engenharia consegue consultar os
   dados pela API; não precisa baixar arquivos adicionais manualmente agora.

Não precisamos de novas chaves nem de outro polígono para esta etapa. A prévia
segue disponível com os avisos de revisão pendente enquanto fechamos a definição
do indicador. Os limites de início de arquivo também não serão tratados como
datas de lançamento físico dos satélites.
