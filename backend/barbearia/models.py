import random
import string
from django.db import models
from django.conf import settings

def gen_voucher_code():
    return "WC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

class Servico(models.Model):
    nome = models.CharField(max_length=150, verbose_name="Nome do Serviço")
    descricao = models.TextField(blank=True, default="", verbose_name="Descrição")
    duracao_minutos = models.PositiveIntegerField(default=30, verbose_name="Duração (min)")
    preco_base = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Preço Base (R$)")
    imagem_url = models.URLField(max_length=500, blank=True, null=True, verbose_name="URL da Imagem")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")

    class Meta:
        verbose_name = "Serviço"
        verbose_name_plural = "Serviços"
        ordering = ["preco_base"]

    def __str__(self):
        return f"{self.nome} - R$ {self.preco_base}"

    def to_dict(self):
        return {
            "id": str(self.id),
            "nome": self.nome,
            "descricao": self.descricao,
            "duracao_minutos": self.duracao_minutos,
            "preco_base": float(self.preco_base),
            "imagem_url": self.imagem_url,
        }

class Agendamento(models.Model):
    STATUS_CHOICES = (
        ("Pendente", "Pendente"),
        ("Confirmado", "Confirmado"),
        ("Concluido", "Concluído"),
        ("Cancelado", "Cancelado"),
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agendamentos",
        verbose_name="Cliente",
    )
    servico = models.ForeignKey(
        Servico,
        on_delete=models.CASCADE,
        related_name="agendamentos",
        verbose_name="Serviço",
    )
    data_hora_inicio = models.DateTimeField(verbose_name="Início")
    data_hora_fim = models.DateTimeField(verbose_name="Fim")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pendente", verbose_name="Status")
    valor_final = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor Final (R$)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")

    class Meta:
        verbose_name = "Agendamento"
        verbose_name_plural = "Agendamentos"
        ordering = ["-data_hora_inicio"]
        indexes = [
            models.Index(fields=["data_hora_inicio"]),
            models.Index(fields=["usuario", "status"]),
        ]

    def __str__(self):
        return f"{self.usuario.nome} - {self.servico.nome} ({self.status}) - {self.data_hora_inicio.strftime('%d/%m/%Y %H:%M')}"

    def to_enriched_dict(self):
        return {
            "id": str(self.id),
            "usuario_id": str(self.usuario.id),
            "usuario_nome": self.usuario.nome,
            "usuario_telefone": self.usuario.telefone,
            "usuario_membro": self.usuario.is_membro,
            "servico_id": str(self.servico.id),
            "servico_nome": self.servico.nome,
            "data_hora_inicio": self.data_hora_inicio.isoformat(),
            "data_hora_fim": self.data_hora_fim.isoformat(),
            "status": self.status,
            "valor_final": float(self.valor_final),
        }

class Voucher(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vouchers",
        verbose_name="Usuário",
    )
    codigo = models.CharField(max_length=30, unique=True, default=gen_voucher_code, verbose_name="Código")
    valor_desconto = models.DecimalField(max_digits=10, decimal_places=2, default=20.00, verbose_name="Valor do Desconto (R$)")
    is_resgatado = models.BooleanField(default=False, verbose_name="Já Utilizado")
    pontos_usados = models.PositiveIntegerField(default=100, verbose_name="Pontos Usados")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")

    class Meta:
        verbose_name = "Voucher"
        verbose_name_plural = "Vouchers"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.codigo} - R$ {self.valor_desconto} ({self.usuario.nome})"

    def to_dict(self):
        return {
            "id": str(self.id),
            "codigo": self.codigo,
            "valor_desconto": float(self.valor_desconto),
            "is_resgatado": self.is_resgatado,
            "created_at": self.created_at.isoformat(),
        }
