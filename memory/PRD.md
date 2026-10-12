# PRD — WC Barbearia

## Problema original
Sistema de Agendamento Autônomo para Barbearia (SaaS MVP) focado em auto-marcação pelos clientes, retenção via clube de membros e gamificação por pontos. Pedido original em Django/DRF/PostgreSQL/Docker; adaptado (com aprovação do usuário) para o stack nativo da plataforma.

## Arquitetura
- Backend: FastAPI (Python) + MongoDB (motor). Rotas sob `/api`.
- Frontend: React (CRA) + Tailwind + Shadcn UI, mobile-first PWA (manifest.json, theme dark luxury dourado).
- Auth: JWT via header `Authorization: Bearer` (token em localStorage `wc_token`). Login por telefone + senha.

## Personas
- Cliente: auto-agenda, acompanha pontos, resgata vouchers, pode ser membro VIP.
- Admin/Barbeiro: gerencia agendamentos e muda status.

## Regras de negócio (implementadas)
- Double-booking: sobreposição com status Pendente/Confirmado → HTTP 409.
- Clube de Membros: sexta e sábado exclusivos para `is_membro` (não-membro recebe 403 e slots bloqueados). Domingo fechado. Horário 09–20h, slots de 30min.
- Motor de fidelidade: transição de status para "Concluido" credita +10 pontos (idempotente).
- Vouchers: 100 pontos → voucher de R$20, debita pontos.

## Modelos (coleções Mongo)
- users: nome, telefone(unique), email, password_hash(bcrypt), role, is_membro, pontos_fidelidade
- servicos: nome, descricao, duracao_minutos, preco_base, imagem_url
- agendamentos: usuario_id, servico_id, data_hora_inicio, data_hora_fim, status, valor_final (índices em data_hora_inicio e [usuario_id,status])
- vouchers: usuario_id, codigo, valor_desconto, is_resgatado, pontos_usados

## API
- GET /api/servicos/ · POST /api/servicos/ (admin)
- GET /api/agendamentos/disponibilidade?data=YYYY-MM-DD&servico_id=
- POST /api/agendamentos/ · GET /api/agendamentos/ · PATCH /api/agendamentos/{id}/status (admin)
- POST /api/fidelidade/resgatar/ · GET /api/vouchers/
- POST /api/auth/register · /api/auth/login · GET /api/auth/me

## Implementado (2026-06-12)
- MVP completo: auth JWT, seed admin (11999990000/admin123) + 4 serviços, fluxo de agendamento 3 passos, home bento, clube/fidelidade, dashboard admin. Testado E2E: 100% backend (16 casos pytest) e 100% frontend.

## Backlog (P1/P2)
- P1: cancelamento/reagendamento pelo cliente; múltiplos barbeiros (dimensão profissional no slot engine).
- P1: aplicar voucher como desconto no valor_final do agendamento.
- P2: notificações (WhatsApp/email), relatórios de receita, PWA offline/service worker, upgrade de cliente para membro na conta.
- P2: migrar on_event para lifespan; tornar resgate de voucher atômico (transação Mongo).
