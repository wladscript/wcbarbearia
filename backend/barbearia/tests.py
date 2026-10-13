from datetime import date, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import Usuario
from barbearia.models import Servico, Agendamento, Voucher

class BarbeariaAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin
        self.admin_user = Usuario.objects.create_superuser(
            telefone="11999990000",
            password="admin123",
            nome="WC Admin",
            email="admin@barbearia.com"
        )

        # Cliente Membro VIP
        self.member_user = Usuario.objects.create_user(
            telefone="11988887777",
            password="cliente123",
            nome="Cliente Membro",
            is_membro=True
        )

        # Cliente Não-Membro
        self.non_member = Usuario.objects.create_user(
            telefone="11977776666",
            password="cliente123",
            nome="Cliente Comum",
            is_membro=False
        )

        # Serviço
        self.servico = Servico.objects.create(
            nome="Corte Clássico",
            descricao="Corte na tesoura e máquina.",
            duracao_minutos=30,
            preco_base=45.00
        )

    def _auth(self, user):
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.key}')
        return token.key

    def test_root_endpoint(self):
        res = self.client.get('/api/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("status"), "ok")

    def test_auth_login_success_and_fail(self):
        # Falha
        res = self.client.post('/api/auth/login', {'telefone': '11999990000', 'senha': 'errada'}, format='json')
        self.assertEqual(res.status_code, 401)

        # Sucesso
        res = self.client.post('/api/auth/login', {'telefone': '11999990000', 'senha': 'admin123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user']['role'], 'admin')

    def test_auth_register_and_duplicate(self):
        # Novo registro
        res = self.client.post('/api/auth/register', {
            'nome': 'Novo Cliente',
            'telefone': '11955554444',
            'senha': 'senha123',
            'is_membro': True
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

        # Telefone duplicado
        res_dup = self.client.post('/api/auth/register', {
            'nome': 'Duplicado',
            'telefone': '11955554444',
            'senha': 'senha123',
            'is_membro': False
        }, format='json')
        self.assertEqual(res_dup.status_code, 400)

    def test_auth_me(self):
        self._auth(self.member_user)
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['nome'], 'Cliente Membro')
        self.assertTrue(res.data['is_membro'])

    def test_servicos_list(self):
        res = self.client.get('/api/servicos/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['nome'], 'Corte Clássico')

    def test_peak_day_rules_and_double_booking(self):
        # Acha a próxima sexta-feira (weekday=4)
        today = date.today()
        days_ahead = (4 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        next_friday = today + timedelta(days=days_ahead)
        dt_str = f"{next_friday.strftime('%Y-%m-%d')}T10:00:00"

        # 1. Não-membro tenta agendar na sexta -> HTTP 403
        self._auth(self.non_member)
        res = self.client.post('/api/agendamentos/', {
            'servico_id': self.servico.id,
            'data_hora_inicio': dt_str
        }, format='json')
        self.assertEqual(res.status_code, 403)

        # 2. Membro agenda com sucesso na sexta -> HTTP 200
        self._auth(self.member_user)
        res_ok = self.client.post('/api/agendamentos/', {
            'servico_id': self.servico.id,
            'data_hora_inicio': dt_str
        }, format='json')
        self.assertEqual(res_ok.status_code, 200)
        appt_id = res_ok.data['id']

        # 3. Tentativa de Double-booking no mesmo horário -> HTTP 409 Conflict
        res_conflict = self.client.post('/api/agendamentos/', {
            'servico_id': self.servico.id,
            'data_hora_inicio': dt_str
        }, format='json')
        self.assertEqual(res_conflict.status_code, 409)

        # 4. Barbeiro altera status para "Concluido" -> credita +10 pontos via Signal
        self._auth(self.admin_user)
        res_patch = self.client.patch(f'/api/agendamentos/{appt_id}/status', {
            'status': 'Concluido'
        }, format='json')
        self.assertEqual(res_patch.status_code, 200)

        self.member_user.refresh_from_db()
        self.assertEqual(self.member_user.pontos_fidelidade, 10)

        # 5. Salvar de novo "Concluido" não duplica pontos (idempotente)
        self.client.patch(f'/api/agendamentos/{appt_id}/status', {
            'status': 'Concluido'
        }, format='json')
        self.member_user.refresh_from_db()
        self.assertEqual(self.member_user.pontos_fidelidade, 10)

    def test_loyalty_voucher_redemption(self):
        self._auth(self.member_user)

        # Saldo insuficiente
        self.member_user.pontos_fidelidade = 40
        self.member_user.save()
        res_fail = self.client.post('/api/fidelidade/resgatar/')
        self.assertEqual(res_fail.status_code, 400)

        # Saldo suficiente (110 pontos)
        self.member_user.pontos_fidelidade = 110
        self.member_user.save()
        res_ok = self.client.post('/api/fidelidade/resgatar/')
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.data['valor_desconto'], 20.0)
        self.assertEqual(res_ok.data['pontos_restantes'], 10)

        # Verifica criação do voucher
        vouchers = self.client.get('/api/vouchers/')
        self.assertEqual(vouchers.status_code, 200)
        self.assertEqual(len(vouchers.data), 1)
        self.assertTrue(vouchers.data[0]['codigo'].startswith('WC-'))
