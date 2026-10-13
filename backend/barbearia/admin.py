from django.contrib import admin
from .models import Servico, Agendamento, Voucher

@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'preco_base', 'duracao_minutos', 'created_at')
    search_fields = ('nome', 'descricao')

@admin.register(Agendamento)
class AgendamentoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'servico', 'data_hora_inicio', 'data_hora_fim', 'status', 'valor_final')
    list_filter = ('status', 'servico', 'data_hora_inicio')
    search_fields = ('usuario__nome', 'usuario__telefone', 'servico__nome')

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'usuario', 'valor_desconto', 'is_resgatado', 'created_at')
    list_filter = ('is_resgatado',)
    search_fields = ('codigo', 'usuario__nome', 'usuario__telefone')
