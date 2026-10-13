from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class UsuarioManager(BaseUserManager):
    def create_user(self, telefone, password=None, **extra_fields):
        if not telefone:
            raise ValueError('O número de telefone é obrigatório.')
        telefone = str(telefone).strip()
        user = self.model(telefone=telefone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, telefone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_membro', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superusuário deve ter is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superusuário deve ter is_superuser=True.')

        return self.create_user(telefone, password, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('cliente', 'Cliente'),
        ('admin', 'Administrador'),
    )

    telefone = models.CharField(max_length=20, unique=True, verbose_name='Telefone')
    nome = models.CharField(max_length=150, verbose_name='Nome Completo')
    email = models.EmailField(blank=True, null=True, verbose_name='E-mail')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cliente', verbose_name='Perfil')
    is_membro = models.BooleanField(default=False, verbose_name='Membro do Clube')
    pontos_fidelidade = models.PositiveIntegerField(default=0, verbose_name='Pontos de Fidelidade')

    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_staff = models.BooleanField(default=False, verbose_name='Equipe')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    objects = UsuarioManager()

    USERNAME_FIELD = 'telefone'
    REQUIRED_FIELDS = ['nome']

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.nome} ({self.telefone})"

    def to_public_dict(self):
        return {
            "id": str(self.id),
            "nome": self.nome,
            "telefone": self.telefone,
            "email": self.email,
            "role": self.role,
            "is_membro": self.is_membro,
            "pontos_fidelidade": self.pontos_fidelidade,
        }
