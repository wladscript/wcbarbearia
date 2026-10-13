from rest_framework import serializers
from .models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nome', 'telefone', 'email', 'role', 'is_membro', 'pontos_fidelidade']
        read_only_fields = ['id', 'pontos_fidelidade']

class RegisterSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    telefone = serializers.CharField(max_length=20)
    senha = serializers.CharField(write_only=True, min_length=4)
    is_membro = serializers.BooleanField(default=False)

    def validate_telefone(self, value):
        tel = value.strip()
        if Usuario.objects.filter(telefone=tel).exists():
            raise serializers.ValidationError("Telefone já cadastrado")
        return tel

    def create(self, validated_data):
        return Usuario.objects.create_user(
            telefone=validated_data['telefone'],
            password=validated_data['senha'],
            nome=validated_data['nome'].strip(),
            is_membro=validated_data.get('is_membro', False),
            role='cliente',
        )

class LoginSerializer(serializers.Serializer):
    telefone = serializers.CharField()
    senha = serializers.CharField(write_only=True)
