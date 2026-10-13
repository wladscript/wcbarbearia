import os
from django.core.management.base import BaseCommand
from accounts.models import Usuario
from barbearia.models import Servico

SEED_SERVICOS = [
    {
        "nome": "Corte Clássico",
        "descricao": "Corte na tesoura e máquina com acabamento na navalha.",
        "duracao_minutos": 30,
        "preco_base": 45.0,
        "imagem_url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Barba Terapia",
        "descricao": "Modelagem de barba com toalha quente e óleos essenciais.",
        "duracao_minutos": 30,
        "preco_base": 40.0,
        "imagem_url": "https://images.unsplash.com/photo-1524230616393-d6229fcd2eff?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Corte + Barba",
        "descricao": "Combo completo: corte premium e barba terapia.",
        "duracao_minutos": 60,
        "preco_base": 75.0,
        "imagem_url": "https://images.unsplash.com/photo-1621645582931-d1d3e6564943?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "nome": "Pezinho / Acabamento",
        "descricao": "Retoque rápido de contorno e pezinho.",
        "duracao_minutos": 30,
        "preco_base": 25.0,
        "imagem_url": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
]

class Command(BaseCommand):
    help = "Semeia os dados iniciais do banco (usuário admin e serviços padrão)."

    def handle(self, *args, **options):
        # 1. Admin
        admin_tel = os.environ.get("ADMIN_TELEFONE", "11999990000").strip()
        admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
        admin_nome = os.environ.get("ADMIN_NOME", "WC Admin")
        admin_email = os.environ.get("ADMIN_EMAIL", "wladscript@gmail.com")

        admin, created = Usuario.objects.get_or_create(
            telefone=admin_tel,
            defaults={
                "nome": admin_nome,
                "email": admin_email,
                "role": "admin",
                "is_membro": True,
                "is_staff": True,
                "is_superuser": True,
            }
        )
        if created:
            admin.set_password(admin_pass)
            admin.save()
            self.stdout.write(self.style.SUCCESS(f"✔ Usuário administrador criado: {admin_tel}"))
        else:
            admin.role = "admin"
            admin.is_staff = True
            admin.is_superuser = True
            admin.is_membro = True
            admin.set_password(admin_pass)
            admin.save()
            self.stdout.write(self.style.WARNING(f"✔ Administrador atualizado: {admin_tel}"))

        # 2. Serviços
        for data in SEED_SERVICOS:
            servico, created = Servico.objects.get_or_create(
                nome=data["nome"],
                defaults={
                    "descricao": data["descricao"],
                    "duracao_minutos": data["duracao_minutos"],
                    "preco_base": data["preco_base"],
                    "imagem_url": data["imagem_url"],
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"✔ Serviço inserido: {servico.nome}"))

        self.stdout.write(self.style.SUCCESS("Banco semeado com sucesso!"))
