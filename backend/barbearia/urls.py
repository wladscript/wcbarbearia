from django.urls import path
from .views import (
    ServicoListCreateView,
    DisponibilidadeView,
    AgendamentoListCreateView,
    AgendamentoStatusUpdateView,
    VoucherListView,
    FidelidadeResgatarView,
)

urlpatterns = [
    path('servicos/', ServicoListCreateView.as_view(), name='servicos_list_create'),
    path('agendamentos/disponibilidade', DisponibilidadeView.as_view(), name='agendamentos_disponibilidade'),
    path('agendamentos/', AgendamentoListCreateView.as_view(), name='agendamentos_list_create'),
    path('agendamentos/<int:pk>/status', AgendamentoStatusUpdateView.as_view(), name='agendamentos_status_update'),
    path('vouchers/', VoucherListView.as_view(), name='vouchers_list'),
    path('fidelidade/resgatar/', FidelidadeResgatarView.as_view(), name='fidelidade_resgatar'),
]
