import logging
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.conf import settings
from django.db.models import F
from .models import Agendamento

logger = logging.getLogger("wc_barbearia")

@receiver(pre_save, sender=Agendamento)
def agendamento_pre_save_handler(sender, instance, **kwargs):
    """
    Rastreia se o status anterior era 'Concluido' para garantir idempotência.
    """
    if instance.pk:
        try:
            previous = Agendamento.objects.get(pk=instance.pk)
            instance._was_concluido = (previous.status == "Concluido")
        except Agendamento.DoesNotExist:
            instance._was_concluido = False
    else:
        instance._was_concluido = False

@receiver(post_save, sender=Agendamento)
def agendamento_post_save_loyalty_handler(sender, instance, created, **kwargs):
    """
    Credita pontos de fidelidade apenas na transição para 'Concluido'.
    """
    was_concluido = getattr(instance, "_was_concluido", False)
    if instance.status == "Concluido" and not was_concluido:
        pts = getattr(settings, "POINTS_PER_SERVICE", 10)
        usuario = instance.usuario
        usuario.pontos_fidelidade = F("pontos_fidelidade") + pts
        usuario.save(update_fields=["pontos_fidelidade"])
        logger.info(
            f"Fidelidade: +{pts} pontos creditados ao usuário {usuario.telefone} "
            f"(agendamento #{instance.id} concluído)"
        )
