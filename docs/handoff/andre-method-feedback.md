# André — revisão da Entrega 5 e métricas disponíveis

> **Registro histórico de entrega.** As pendências abaixo correspondem àquela etapa, não ao estado atual. O v2 recebeu aprovação com escopo restrito; consulte o [status científico atual](../validation-report.md) antes de reenviar esta mensagem como nova solicitação.

André, obrigado pela Entrega 5! Já revisamos o documento. As regras agora estão descritas, mas encontrei diferenças entre este método e a versão que já rodou; por isso ainda não vou chamar a implementação inteira de reconciliada.

Já temos números reais da versão congelada anterior:

- Teste direto, combinado: 286 dias pareados / 25 semanas elegíveis; Spearman 0,866923; PBias -36,58%; MAE 7.164,82 MW; rMAE 37,50%; PICP80 diário 70,98%; largura relativa mediana 1,1353.
- No mesmo conjunto pareado, o benchmark ingênuo teve MAE de 4.716,02 MW. O candidato falhou no limite de viés e na exigência de melhorar esse benchmark.
- Transferência reversa, combinado: 424 dias / 34 semanas; Spearman 0,918411; PBias +16,45%; MAE 883,60 MW; PICP80 diário 75,71%. Os critérios registrados dessa vista combinada passaram, mas não anulam a falha no teste direto. As vistas individuais têm limitações adicionais de suporte e desempenho no relatório.
- A decisão automática da versão testada é Plano B, com harmonização não aprovada. O parecer humano continua com você.

Ponto importante: a Entrega 5 manda extrapolar linearmente acima do Q99; a versão congelada limitava o EQM ao teto do treino. Também falta aplicar a restrição de PBias na seleção dos candidatos dentro do treino. Precisamos versionar e testar essa revisão separadamente; os números acima não são resultados do method.md novo. Como o teste anterior já foi visto, uma nova rodada nele terá essa ressalva explícita.

O conjunto efetivamente adquirido cobre 2012–2015 e janelas sazonais de 2017–2024; não a série integral 2000–2026. As regras novas de referência sazonal/anomalias/temporada ainda não foram executadas nem aprovadas. Não precisamos de outro download manual agora.

Para fechar a implementação determinística, quando puder, confirma só:
1. O limite de PBias para selecionar modelos é sobre todas as previsões OOF juntas ou em cada fold? Se os dois candidatos falharem, podemos bloquear o estrato e manter Plano B?
2. Na referência sazonal, anos com menos de 10 dias válidos também saem do pool de valores, ou apenas não contam entre os 8 anos mínimos?
3. Podemos fixar uma regra explícita para os extremos da janela circular perto de 29/02 e usar o primeiro dia cronológico no empate de pico da temporada?

Para o pitch de agora, a formulação sustentada pelos testes é: “Testamos a harmonização com observações reais e critérios registrados. O candidato não passou na validação direta; mantemos as plataformas separadas e apresentamos a harmonização como pesquisa em andamento.”

O relatório de engenharia e a tabela completa estão em docs/method-delivery-review.md; seu parecer deve listar os diagnósticos ainda não executados, sem assinar aprovação de harmonização.
