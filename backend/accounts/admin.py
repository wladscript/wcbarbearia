from django.contrib import admin
from .models import Usuario

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ('telefone', 'nome', 'role', 'is_membro', 'pontos_fidelidade', 'created_at')
    search_fields = ('telefone', 'nome', 'email')
    list_filter = ('role', 'is_membro', 'is_staff')
