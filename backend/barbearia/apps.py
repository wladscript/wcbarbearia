from django.apps import AppConfig

class BarbeariaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'barbearia'
    verbose_name = 'Gestão da Barbearia'

    def ready(self):
        import barbearia.signals  # Registra os sinais de fidelidade
