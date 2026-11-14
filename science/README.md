# Pipeline offline — pendente

Este diretório reserva o trabalho científico do André. Não há ingestão, calibração ou validação implementadas. A aplicação começa com fixtures e não executa ciência no browser.

Antes da ingestão: confirmar AOI/coleções, definir regra de cobertura e qualidade, dia solar local, associação de plataformas, amostra mínima e limiares de aceitação com timestamp. Preservar proveniência e hashes. Outputs pesados não são versionados.

Exportação esperada: [handoff](../docs/data-handoff.md). Os limiares em `configs/decisions.json` ficam nulos até decisão do responsável científico.
