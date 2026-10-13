from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions

class BearerTokenAuthentication(TokenAuthentication):
    """
    Autenticação que suporta tanto 'Bearer <token>' quanto 'Token <token>'
    no cabeçalho Authorization, garantindo compatibilidade direta com frontend Vanilla e JWT/Token.
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth = request.headers.get('Authorization', '').split()
        if not auth:
            return None

        # Aceita tanto 'Bearer' quanto 'Token'
        if auth[0].lower() in ['bearer', 'token']:
            if len(auth) == 1:
                msg = 'Token inválido. Nenhum token fornecido.'
                raise exceptions.AuthenticationFailed(msg)
            elif len(auth) > 2:
                msg = 'Token inválido. O cabeçalho de token não deve conter espaços extras.'
                raise exceptions.AuthenticationFailed(msg)
            return self.authenticate_credentials(auth[1])

        return None
