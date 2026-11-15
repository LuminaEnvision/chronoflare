# Feedback para André — Entrega 3

> **Registro histórico de entrega.** As pendências abaixo correspondem àquela etapa, não ao estado atual. O v2 recebeu aprovação com escopo restrito; consulte o [status científico atual](../validation-report.md) antes de reenviar esta mensagem como nova solicitação.

**Atualização:** a v1.1 resolveu os pontos abaixo. Veja o
[feedback atual](andre-indicator-v1.1-feedback.md); este texto é histórico.

André, obrigado pela Entrega 3! Agora ficaram definidos o alvo fixo S-NPP, as
séries separadas por plataforma/turno, o filtro SP com FRP positivo e a combinação
convexa Terra/Aqua sem somar as estimativas. Registramos também os períodos de
experimento. Entendemos que os limites de aprovação vêm na Entrega 4.

Já implementamos uma auditoria de qualidade que preserva todas as linhas e
registra os motivos de rejeição. Ela foi testada nos 204.919 registros dos dois
arquivos nacionais originais; identificou inclusive 83 registros VIIRS com FRP
não positivo. Isso não altera silenciosamente a prévia já publicada: aquela
prévia continua identificada com o filtro anterior até gerarmos a nova versão.

Para fechar a implementação completa, quando puder, ajuda nestes pontos:

1. **Duplicatas com valores diferentes:** na mesma chave você escreveu “primeiro
   registro” e “maior FRP”. Depois de priorizar SP, qual vence: maior FRP e, no
   empate, primeiro registro? Aplicamos o filtro de qualidade antes de escolher
   o vencedor? Também precisamos registrar como arredondar os empates exatos na
   quinta casa decimal; podemos propor uma convenção determinística no código.
2. **Falta de um turno na estimativa:** se existe D mas N está ausente, a soma
   observada parcial está clara. Para a estimativa calibrada diária, mostramos
   apenas os turnos disponíveis com aviso de parcial ou mantemos null até ter os
   dois? Não vamos transformar o turno ausente em zero. A referência S-NPP precisa
   ser comparada nos mesmos turnos disponíveis.
3. **Semanas:** pode incluir na Entrega 4 em qual dia começa a semana, o mínimo
   de dias válidos pareados e como tratar semanas incompletas?
4. **Incerteza e pesos:** na Entrega 4, registrar o método do intervalo de 80%,
   a regra quando algum MAE é zero e o mínimo de amostras por estrato. A escolha
   entre razão e EQM será feita dentro do treino, sem usar o teste final para
   escolher o método.

Não precisa reenviar as regras de cobertura ou os links já confirmados. Também
não precisamos de mais chave nem de novos downloads manuais para esta etapa.
A aquisição dos períodos maiores será planejada depois, usando as janelas que
você definiu. Os coeficientes do exemplo ficam apenas como exemplo; a
harmonização continua bloqueada até termos ajuste, incerteza e validação reais.
