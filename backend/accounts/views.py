from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Usuario
from .serializers import RegisterSerializer, LoginSerializer

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            # Formatando erro similar à API anterior
            error_msg = "Dados inválidos"
            if 'telefone' in serializer.errors:
                error_msg = serializer.errors['telefone'][0]
            elif 'senha' in serializer.errors:
                error_msg = serializer.errors['senha'][0]
            elif 'nome' in serializer.errors:
                error_msg = serializer.errors['nome'][0]
            return Response({"detail": error_msg, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "user": user.to_public_dict()
        }, status=status.HTTP_200_OK)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Telefone e senha são obrigatórios"}, status=status.HTTP_400_BAD_REQUEST)

        telefone = serializer.validated_data['telefone'].strip()
        senha = serializer.validated_data['senha']

        try:
            user = Usuario.objects.get(telefone=telefone)
            if not user.check_password(senha):
                return Response({"detail": "Telefone ou senha inválidos"}, status=status.HTTP_401_UNAUTHORIZED)
        except Usuario.DoesNotExist:
            return Response({"detail": "Telefone ou senha inválidos"}, status=status.HTTP_401_UNAUTHORIZED)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "user": user.to_public_dict()
        }, status=status.HTTP_200_OK)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(request.user.to_public_dict(), status=status.HTTP_200_OK)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            Token.objects.filter(user=request.user).delete()
        except Exception:
            pass
        return Response({"detail": "Desconectado com sucesso"}, status=status.HTTP_200_OK)
