# André — retorno da Entrega 4

Obrigado pela Entrega 4! Os critérios e o JSON já foram incorporados com registro
de versão, hash do arquivo recebido e separação entre o horário declarado de
pré-registro e o horário de recebimento pela engenharia.

Para ficar transparente, seguimos o JSON onde o texto diverge: médias semanais
pareadas como escala de avaliação; PBias de até 30% para Terra e 25% para
Aqua/combinado; rMAE combinado até 0,45 **e** melhora estrita sobre a emenda
 ingênua no mesmo conjunto de semanas; PICP retroativo mínimo de 68%; teste com
pelo menos dois anos distintos, inclusive no fallback sazonal. Não acrescentamos
uma exigência de 20% que não consta no JSON.

As Entregas 3 e 4 estão fechadas para esta implementação; não há nova pendência
de esclarecimento nem necessidade de baixar arquivos manualmente agora.
Continuamos no Plano B por falta de amostra e de validação executada, e não por
reprovação de um modelo: temos somente quinze dias de 2019 e quinze de 2020,
sem modelo ajustado ou métricas fora da amostra.

O próximo trabalho da engenharia é ampliar os dados para cumprir os mínimos de
anos, dias, semanas e estratos; treinar sem usar o holdout; congelar o modelo e
rodar as validações direta e retroativa. Depois compartilhamos os resultados para
sua revisão científica. Intervalos semanais seguem sem PICP calculado, pois a
receita atual define intervalos diários; não vamos somar limites e chamar isso de
cobertura semanal de 80%.
