from rest_framework import serializers
from .models import Servico, Agendamento, Voucher

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = ['id', 'nome', 'descricao', 'duracao_minutos', 'preco_base', 'imagem_url']

class AgendamentoInputSerializer(serializers.Serializer):
    servico_id = serializers.IntegerField()
    data_hora_inicio = serializers.CharField()  # ISO string: "2026-10-15T10:00:00"

class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["Pendente", "Confirmado", "Concluido", "Cancelado"])

class VoucherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Voucher
        fields = ['id', 'codigo', 'valor_desconto', 'is_resgatado', 'created_at']
